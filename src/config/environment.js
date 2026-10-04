// A staging build can exercise the same production bundle against sandbox.
// Never set VITE_ROTAVOY_ENV=staging on the public production deployment.
export const isProductionDeployment = import.meta.env.PROD &&
  import.meta.env.VITE_ROTAVOY_ENV !== "staging";
