export const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

export function getExplorerTransactionUrl(chainId) {
  return Number(chainId) === 1
    ? "https://etherscan.io/tx"
    : "https://bscscan.com/tx";
}
