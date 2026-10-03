import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import {
  usePublicClient,
  useSendTransaction,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { isAddress, parseUnits } from "viem";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  ERC20_TRANSFER_ABI,
  getExplorerTransactionUrl,
} from "../../config/cryptoPayment";
import "./CryptoPayment.css";

function shortenAddress(value) {
  const address = String(value || "");
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getPaymentErrorMessage(
  error,
  transactionWasSubmitted,
  text,
  network
) {
  const message = String(error?.shortMessage || error?.message || "");

  if (transactionWasSubmitted) {
    return text(
      "travelPayment.transactionSubmitted",
      `The transaction was submitted. Use Verify Payment after it is confirmed on ${network}.`
    );
  }

  if (
    error?.code === 4001 ||
    /rejected|denied|cancelled|canceled/i.test(message)
  ) {
    return text(
      "travelPayment.walletRequestCancelled",
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
      pattern: /lower than the booking total/i,
      key: "insufficientPaymentAmount",
      fallback: "The transaction amount is lower than the booking total.",
    },
    {
      pattern: /already been used/i,
      key: "transactionAlreadyUsed",
      fallback: "This transaction has already been used for another booking.",
    },
    {
      pattern: /already paid/i,
      key: "reservationAlreadyPaid",
      fallback: "This booking has already been paid.",
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
    return text(`travelPayment.${knownError.key}`, knownError.fallback);
  }

  return (
    message ||
    text(
      "travelPayment.cryptoPaymentFailed",
      "The crypto payment could not be completed."
    )
  );
}

function CryptoPayment({
  booking,
  onBookingUpdated,
  verifyPaymentRequest,
  forceDisplay = false,
}) {
  const { t } = useLanguage();
  const [paymentStage, setPaymentStage] = useState("idle");
  const [paymentError, setPaymentError] = useState("");
  const [transactionHash, setTransactionHash] = useState(
    booking?.payment?.transactionHash || ""
  );
  const [manualOpen, setManualOpen] = useState(false);
  const [manualHash, setManualHash] = useState("");
  const [copied, setCopied] = useState(false);

  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const switchChainMutation = useSwitchChain();
  const writeContractMutation = useWriteContract();
  const sendTransactionMutation = useSendTransaction();

  const payment = booking?.payment || {};
  const paymentChainId = Number(payment.chainId || 56);
  const publicClient = usePublicClient({ chainId: paymentChainId });

  useEffect(() => {
    setTransactionHash(booking?.payment?.transactionHash || "");
  }, [booking?.payment?.transactionHash]);

  if (!booking || (!forceDisplay && booking.paymentMethod !== "crypto")) {
    return null;
  }

  const text = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const tokenAddress = String(payment.tokenAddress || "");
  const recipientAddress = String(payment.recipientAddress || "");
  const tokenDecimals = Number(payment.tokenDecimals ?? 18);
  const paymentAmount = String(
    payment.expectedAmount || Number(booking.total || 0).toFixed(2)
  );
  const paymentToken = payment.token || "USDT";
  const paymentNetwork = payment.network || "BNB Smart Chain";
  const assetType = payment.assetType || "erc20";
  const gasToken =
    payment.gasToken || (paymentChainId === 1 ? "ETH" : "BNB");
  const explorerTransactionUrl =
    payment.explorerTransactionUrl ||
    getExplorerTransactionUrl(paymentChainId);
  const pendingTransactionHash =
    transactionHash || payment.transactionHash || "";

  const paymentConfigured =
    isAddress(recipientAddress) &&
    Number.isInteger(tokenDecimals) &&
    tokenDecimals >= 0 &&
    (assetType === "native" || isAddress(tokenAddress));

  const isPaid = booking.paymentStatus === "paid";
  const isPaymentBusy = [
    "switching",
    "signing",
    "confirming",
    "verifying",
  ].includes(paymentStage);

  const updateBooking = (nextBooking) => {
    setTransactionHash(nextBooking.payment?.transactionHash || "");
    onBookingUpdated?.(nextBooking);
  };

  const verifyPayment = async (hash, payerAddress = "") => {
    setPaymentStage("verifying");
    setPaymentError("");

    if (typeof verifyPaymentRequest !== "function") {
      throw new Error("Travel payment verification is unavailable.");
    }

    const verifiedBooking = await verifyPaymentRequest(booking.id, {
      email: booking.customer?.email,
      transactionHash: hash,
      payerAddress,
    });

    updateBooking(verifiedBooking);
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
        setPaymentError(
          getPaymentErrorMessage(error, false, text, paymentNetwork)
        );
      }
      return;
    }

    if (!paymentConfigured) {
      setPaymentStage("error");
      setPaymentError(
        text(
          "travelPayment.receivingWalletNotConfigured",
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
            "travelPayment.walletNetworkUnavailable",
            "Wallet network switching is unavailable."
          )
        );
      }

      await switchChainAsync({ chainId: paymentChainId });
      setPaymentStage("signing");

      let hash = "";

      if (assetType === "native") {
        const sendTransactionAsync =
          sendTransactionMutation.sendTransactionAsync ||
          sendTransactionMutation.mutateAsync;

        if (typeof sendTransactionAsync !== "function") {
          throw new Error(
            text(
              "travelPayment.nativeTransactionsUnavailable",
              "Wallet native-coin transactions are unavailable."
            )
          );
        }

        hash = await sendTransactionAsync({
          to: recipientAddress,
          value: parseUnits(paymentAmount, tokenDecimals),
          chainId: paymentChainId,
        });
      } else {
        const writeContractAsync =
          writeContractMutation.writeContractAsync ||
          writeContractMutation.mutateAsync;

        if (typeof writeContractAsync !== "function") {
          throw new Error(
            text(
              "travelPayment.contractTransactionsUnavailable",
              "Wallet contract transactions are unavailable."
            )
          );
        }

        hash = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [
            recipientAddress,
            parseUnits(paymentAmount, tokenDecimals),
          ],
          chainId: paymentChainId,
        });
      }

      submittedHash = hash;

      const pendingBooking = {
        ...booking,
        paymentStatus: "pending",
        payment: {
          ...payment,
          payerAddress: String(address).toLowerCase(),
          transactionHash: hash,
        },
      };

      updateBooking(pendingBooking);
      setPaymentStage("confirming");

      if (!publicClient) {
        throw new Error(
          text(
            "travelPayment.blockchainClientUnavailable",
            `${paymentNetwork} client is unavailable.`
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
        getPaymentErrorMessage(
          error,
          Boolean(submittedHash),
          text,
          paymentNetwork
        )
      );
    }
  };

  const copyRecipient = async () => {
    if (!recipientAddress) return;

    try {
      await navigator.clipboard.writeText(recipientAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setPaymentError(
        "Cüzdan adresi kopyalanamadı. Adresi seçip kendin kopyalayabilirsin."
      );
    }
  };

  const verifyManualPayment = async (event) => {
    event.preventDefault();
    if (!manualHash.trim() || isPaymentBusy || isPaid) return;

    try {
      await verifyPayment(manualHash.trim());
      setManualOpen(false);
    } catch (error) {
      setPaymentStage("error");
      setPaymentError(
        getPaymentErrorMessage(error, false, text, paymentNetwork)
      );
    }
  };

  const getPaymentButtonText = () => {
    if (!paymentConfigured) {
      return text(
        "travelPayment.paymentSetupRequired",
        "Payment setup required"
      );
    }

    if (paymentStage === "switching") {
      return `${paymentNetwork} ağına geçiliyor...`;
    }

    if (paymentStage === "signing") {
      return text(
        "travelPayment.confirmInWallet",
        "Confirm in wallet..."
      );
    }

    if (paymentStage === "confirming") {
      return text(
        "travelPayment.waitingForConfirmation",
        "Waiting for confirmation..."
      );
    }

    if (paymentStage === "verifying") {
      return text(
        "travelPayment.verifyingPayment",
        "Verifying payment..."
      );
    }

    if (pendingTransactionHash) {
      return text(
        "travelPayment.verifyPayment",
        "Verify Payment"
      );
    }

    if (!isConnected) {
      return text(
        "travelPayment.connectWallet",
        "Connect Wallet"
      );
    }

    return `${text("travelPayment.pay", "Pay")} ${paymentAmount} ${paymentToken}`;
  };

  if (isPaid && payment.transactionHash) {
    return (
      <a
        className="cryptoPaymentHash cryptoPaymentHashPaid"
        href={`${explorerTransactionUrl}/${payment.transactionHash}`}
        target="_blank"
        rel="noreferrer"
      >
        {text("travelPayment.paymentTransaction", "Payment transaction")} {" "}
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
            {text("travelPayment.onChainPayment", "On-chain payment")}
          </span>
          <h2>
            {text("travelPayment.payWith", "Pay with")} {paymentToken}
          </h2>
          <p>
            {paymentNetwork} ağında tam tutarı gönder. Backend transferi
            zincirde doğruladıktan sonra rezervasyonu işleme alır.
          </p>
        </div>

        <WalletCards size={30} />
      </div>

      <div className="cryptoPaymentGrid">
        <div>
          <small>{text("travelPayment.amount", "Amount")}</small>
          <strong>
            {paymentAmount} {paymentToken}
          </strong>
        </div>
        <div>
          <small>{text("travelPayment.network", "Network")}</small>
          <strong>{paymentNetwork}</strong>
        </div>
        <div>
          <small>{text("travelPayment.recipient", "Recipient")}</small>
          <strong>
            {recipientAddress
              ? shortenAddress(recipientAddress)
              : text("travelPayment.notConfigured", "Not configured")}
          </strong>
        </div>
        <div>
          <small>{text("travelPayment.yourWallet", "Your wallet")}</small>
          <strong>
            {isConnected && address
              ? shortenAddress(address)
              : text("travelPayment.notConnected", "Not connected")}
          </strong>
        </div>
      </div>

      {payment.quoteUsdPrice && !["USDT", "USDC"].includes(paymentToken) && (
        <div className="cryptoPaymentStatus">
          <span>20 dakikalık ödeme tutarı</span>
          <strong>
            1 {paymentToken} ≈ ${Number(payment.quoteUsdPrice).toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
      )}

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
          href={`${explorerTransactionUrl}/${pendingTransactionHash}`}
          target="_blank"
          rel="noreferrer"
        >
          {text("travelPayment.viewTransaction", "View transaction")} {" "}
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

      <button
        type="button"
        className="cryptoPaymentManualToggle"
        onClick={() => setManualOpen((open) => !open)}
        disabled={isPaymentBusy || !paymentConfigured}
      >
        {manualOpen
          ? "Manuel ödeme alanını kapat"
          : "Cüzdan bağlamadan manuel gönder"}
      </button>

      {manualOpen && (
        <form
          className="cryptoPaymentManual"
          onSubmit={verifyManualPayment}
        >
          <strong>Manuel {paymentToken} gönderimi</strong>
          <p>
            {paymentNetwork} ağında tam olarak{" "}
            <b>
              {paymentAmount} {paymentToken}
            </b>{" "}
            gönder. Yanlış ağdaki transfer sistem tarafından kabul edilmez.
          </p>
          <label>
            Alıcı cüzdan adresi
            <span className="cryptoPaymentAddress">
              <code>{recipientAddress}</code>
              <button type="button" onClick={copyRecipient}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {" "}
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
            </span>
          </label>
          <label>
            İşlem hash&apos;i (TxID)
            <input
              required
              value={manualHash}
              onChange={(event) => setManualHash(event.target.value)}
              placeholder="0x…"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="cryptoPaymentManualVerify"
            disabled={isPaymentBusy}
          >
            {isPaymentBusy ? (
              <LoaderCircle
                className="cryptoPaymentSpinner"
                size={17}
              />
            ) : (
              <ShieldCheck size={17} />
            )}
            Gönderimi doğrula ve devam et
          </button>
        </form>
      )}

      <small className="cryptoPaymentGasNote">
        İşlem ücreti için cüzdanda küçük bir miktar {gasToken} gerekir.
      </small>
    </section>
  );
}

export default CryptoPayment;
