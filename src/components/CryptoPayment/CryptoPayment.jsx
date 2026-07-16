import { useEffect, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { isAddress, parseUnits } from "viem";
import { useLanguage } from "../../i18n/LanguageContext";
import { verifyOrderPayment } from "../../services/orderApi";
import {
  BSC_EXPLORER_TRANSACTION_URL,
  ERC20_TRANSFER_ABI,
} from "../../config/cryptoPayment";
import "./CryptoPayment.css";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function persistOrder(order) {
  const existingOrders = safeParse(
    localStorage.getItem("rotavoy_orders"),
    []
  );
  let orderWasUpdated = false;

  const nextOrders = Array.isArray(existingOrders)
    ? existingOrders.map((existingOrder) => {
        if (existingOrder.id !== order.id) return existingOrder;
        orderWasUpdated = true;
        return order;
      })
    : [];

  if (!orderWasUpdated) nextOrders.unshift(order);

  localStorage.setItem("rotavoy_orders", JSON.stringify(nextOrders));
  localStorage.setItem("rotavoy_last_order", JSON.stringify(order));
}

function shortenAddress(value) {
  const address = String(value || "");
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getPaymentErrorMessage(error, transactionWasSubmitted, text) {
  const message = String(error?.shortMessage || error?.message || "");

  if (transactionWasSubmitted) {
    return text(
      "orderSuccessPage.transactionSubmitted",
      "The transaction was submitted. Use Verify Payment after it is confirmed on BNB Smart Chain."
    );
  }

  if (
    error?.code === 4001 ||
    /rejected|denied|cancelled|canceled/i.test(message)
  ) {
    return text(
      "orderSuccessPage.walletRequestCancelled",
      "The wallet request was cancelled."
    );
  }

  const knownErrors = [
    {
      pattern: /not confirmed yet|needs? \d+ confirmation/i,
      key: "transactionNotConfirmed",
      fallback: "The transaction is not confirmed yet. Try again shortly.",
    },
    {
      pattern: /wrong token contract/i,
      key: "wrongTokenContract",
      fallback: "The transaction used the wrong token contract.",
    },
    {
      pattern: /different wallet/i,
      key: "differentPayerWallet",
      fallback: "The transaction was sent from a different wallet.",
    },
    {
      pattern: /wrong wallet/i,
      key: "wrongRecipientWallet",
      fallback: "The transaction was sent to the wrong receiving wallet.",
    },
    {
      pattern: /lower than the order total/i,
      key: "insufficientPaymentAmount",
      fallback: "The transaction amount is lower than the order total.",
    },
    {
      pattern: /already been used/i,
      key: "transactionAlreadyUsed",
      fallback: "This transaction has already been used for another order.",
    },
    {
      pattern: /already paid/i,
      key: "orderAlreadyPaid",
      fallback: "This order has already been paid.",
    },
    {
      pattern: /rpc|blockchain.*unavailable|could not be reached|timed out/i,
      key: "blockchainUnavailable",
      fallback: "The blockchain service is temporarily unavailable.",
    },
    {
      pattern: /not configured/i,
      key: "receivingWalletNotConfigured",
      fallback: "The crypto receiving wallet has not been configured on the server yet.",
    },
    {
      pattern: /transaction failed|blockchain transaction failed/i,
      key: "transactionFailed",
      fallback: "The blockchain transaction failed.",
    },
    {
      pattern: /invalid|valid transaction hash|required|transfer data/i,
      key: "invalidTransaction",
      fallback: "The transaction details are invalid.",
    },
  ];

  const knownError = knownErrors.find(({ pattern }) => pattern.test(message));

  if (knownError) {
    return text(`orderSuccessPage.${knownError.key}`, knownError.fallback);
  }

  return (
    message ||
    text(
      "orderSuccessPage.cryptoPaymentFailed",
      "The crypto payment could not be completed."
    )
  );
}

function CryptoPayment({ order, onOrderUpdated }) {
  const { t } = useLanguage();
  const [paymentStage, setPaymentStage] = useState("idle");
  const [paymentError, setPaymentError] = useState("");
  const [transactionHash, setTransactionHash] = useState(
    order?.payment?.transactionHash || ""
  );

  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const switchChainMutation = useSwitchChain();
  const writeContractMutation = useWriteContract();

  const payment = order?.payment || {};
  const paymentChainId = Number(payment.chainId || 56);
  const publicClient = usePublicClient({ chainId: paymentChainId });

  useEffect(() => {
    setTransactionHash(order?.payment?.transactionHash || "");
  }, [order?.payment?.transactionHash]);

  if (!order || order.paymentMethod !== "crypto") return null;

  const text = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const tokenAddress = String(payment.tokenAddress || "");
  const recipientAddress = String(payment.recipientAddress || "");
  const tokenDecimals = Number(payment.tokenDecimals ?? 18);
  const paymentAmount = String(
    payment.expectedAmount || Number(order.total || 0).toFixed(2)
  );
  const paymentToken = payment.token || "USDT";
  const pendingTransactionHash =
    transactionHash || payment.transactionHash || "";
  const paymentConfigured =
    isAddress(tokenAddress) &&
    isAddress(recipientAddress) &&
    Number.isInteger(tokenDecimals) &&
    tokenDecimals >= 0;
  const isPaid = order.paymentStatus === "paid";
  const isPaymentBusy = [
    "switching",
    "signing",
    "confirming",
    "verifying",
  ].includes(paymentStage);

  const updateOrder = (nextOrder) => {
    persistOrder(nextOrder);
    setTransactionHash(nextOrder.payment?.transactionHash || "");
    onOrderUpdated?.(nextOrder);
  };

  const verifyPayment = async (hash, payerAddress = "") => {
    setPaymentStage("verifying");
    setPaymentError("");

    const verifiedOrder = await verifyOrderPayment(order.id, {
      email: order.customer?.email,
      transactionHash: hash,
      payerAddress,
    });

    updateOrder(verifiedOrder);
    setPaymentStage("paid");
  };

  const handleCryptoPayment = async () => {
    if (isPaymentBusy || isPaid) return;

    if (pendingTransactionHash) {
      try {
        await verifyPayment(
          pendingTransactionHash,
          payment.payerAddress || address || ""
        );
      } catch (error) {
        setPaymentStage("error");
        setPaymentError(getPaymentErrorMessage(error, false, text));
      }
      return;
    }

    if (!paymentConfigured) {
      setPaymentStage("error");
      setPaymentError(
        text(
          "orderSuccessPage.receivingWalletNotConfigured",
          "The crypto receiving wallet has not been configured on the server yet."
        )
      );
      return;
    }

    if (!isConnected || !address) {
      await open({ view: "Connect" });
      return;
    }

    let submittedHash = "";

    try {
      setPaymentError("");
      setPaymentStage("switching");

      const switchChainAsync =
        switchChainMutation.switchChainAsync || switchChainMutation.mutateAsync;

      if (typeof switchChainAsync !== "function") {
        throw new Error(
          text(
            "orderSuccessPage.walletNetworkUnavailable",
            "Wallet network switching is unavailable."
          )
        );
      }

      await switchChainAsync({ chainId: paymentChainId });
      setPaymentStage("signing");

      const writeContractAsync =
        writeContractMutation.writeContractAsync ||
        writeContractMutation.mutateAsync;

      if (typeof writeContractAsync !== "function") {
        throw new Error(
          text(
            "orderSuccessPage.contractTransactionsUnavailable",
            "Wallet contract transactions are unavailable."
          )
        );
      }

      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [
          recipientAddress,
          parseUnits(paymentAmount, tokenDecimals),
        ],
        chainId: paymentChainId,
      });

      submittedHash = hash;

      const pendingOrder = {
        ...order,
        paymentStatus: "pending",
        payment: {
          ...payment,
          payerAddress: String(address).toLowerCase(),
          transactionHash: hash,
        },
      };

      updateOrder(pendingOrder);
      setPaymentStage("confirming");

      if (!publicClient) {
        throw new Error(
          text(
            "orderSuccessPage.bscClientUnavailable",
            "The BNB Smart Chain client is unavailable."
          )
        );
      }

      await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 180_000,
      });

      await verifyPayment(hash, String(address).toLowerCase());
    } catch (error) {
      setPaymentStage("error");
      setPaymentError(
        getPaymentErrorMessage(error, Boolean(submittedHash), text)
      );
    }
  };

  const getPaymentButtonText = () => {
    if (!paymentConfigured) {
      return text(
        "orderSuccessPage.paymentSetupRequired",
        "Payment setup required"
      );
    }
    if (paymentStage === "switching") {
      return text(
        "orderSuccessPage.switchingToBnb",
        "Switching to BNB Chain..."
      );
    }
    if (paymentStage === "signing") {
      return text(
        "orderSuccessPage.confirmInWallet",
        "Confirm in wallet..."
      );
    }
    if (paymentStage === "confirming") {
      return text(
        "orderSuccessPage.waitingForConfirmation",
        "Waiting for confirmation..."
      );
    }
    if (paymentStage === "verifying") {
      return text(
        "orderSuccessPage.verifyingPayment",
        "Verifying payment..."
      );
    }
    if (pendingTransactionHash) {
      return text("orderSuccessPage.verifyPayment", "Verify Payment");
    }
    if (!isConnected) {
      return text("orderSuccessPage.connectWallet", "Connect Wallet");
    }
    return `${text("orderSuccessPage.pay", "Pay")} ${paymentAmount} ${paymentToken}`;
  };

  if (isPaid && payment.transactionHash) {
    return (
      <a
        className="cryptoPaymentHash cryptoPaymentHashPaid"
        href={`${BSC_EXPLORER_TRANSACTION_URL}/${payment.transactionHash}`}
        target="_blank"
        rel="noreferrer"
      >
        {text("orderSuccessPage.paymentTransaction", "Payment transaction")} {" "}
        {shortenAddress(payment.transactionHash)}
        <ExternalLink size={15} />
      </a>
    );
  }

  if (isPaid) return null;

  return (
    <section className="cryptoPaymentPanel">
      <div className="cryptoPaymentHeader">
        <div>
          <span className="cryptoPaymentBadge">
            <ShieldCheck size={16} />
            {text("orderSuccessPage.onChainPayment", "On-chain payment")}
          </span>
          <h2>
            {text("orderSuccessPage.payWith", "Pay with")} {paymentToken}
          </h2>
          <p>
            {text(
              "orderSuccessPage.cryptoVerificationText",
              "Send the exact order total on BNB Smart Chain. The backend verifies the transaction before the order moves to processing."
            )}
          </p>
        </div>

        <WalletCards size={30} />
      </div>

      <div className="cryptoPaymentGrid">
        <div>
          <small>{text("orderSuccessPage.amount", "Amount")}</small>
          <strong>
            {paymentAmount} {paymentToken}
          </strong>
        </div>
        <div>
          <small>{text("orderSuccessPage.network", "Network")}</small>
          <strong>{payment.network || "BNB Smart Chain"}</strong>
        </div>
        <div>
          <small>{text("orderSuccessPage.recipient", "Recipient")}</small>
          <strong>
            {recipientAddress
              ? shortenAddress(recipientAddress)
              : text("orderSuccessPage.notConfigured", "Not configured")}
          </strong>
        </div>
        <div>
          <small>{text("orderSuccessPage.yourWallet", "Your wallet")}</small>
          <strong>
            {isConnected && address
              ? shortenAddress(address)
              : text("orderSuccessPage.notConnected", "Not connected")}
          </strong>
        </div>
      </div>

      {paymentStage !== "idle" && paymentStage !== "error" && (
        <div className="cryptoPaymentStatus">
          <LoaderCircle className="cryptoPaymentSpinner" size={18} />
          <span>{getPaymentButtonText()}</span>
        </div>
      )}

      {paymentError && (
        <div className="cryptoPaymentError">{paymentError}</div>
      )}

      {pendingTransactionHash && (
        <a
          className="cryptoPaymentHash"
          href={`${BSC_EXPLORER_TRANSACTION_URL}/${pendingTransactionHash}`}
          target="_blank"
          rel="noreferrer"
        >
          {text("orderSuccessPage.viewTransaction", "View transaction")} {" "}
          {shortenAddress(pendingTransactionHash)}
          <ExternalLink size={15} />
        </a>
      )}

      <button
        type="button"
        className="cryptoPaymentButton"
        onClick={handleCryptoPayment}
        disabled={isPaymentBusy || !paymentConfigured}
      >
        {isPaymentBusy ? (
          <LoaderCircle className="cryptoPaymentSpinner" size={19} />
        ) : (
          <WalletCards size={19} />
        )}
        {getPaymentButtonText()}
      </button>

      <small className="cryptoPaymentGasNote">
        {text(
          "orderSuccessPage.gasNote",
          "A small amount of BNB is required in the connected wallet for gas."
        )}
      </small>
    </section>
  );
}

export default CryptoPayment;
