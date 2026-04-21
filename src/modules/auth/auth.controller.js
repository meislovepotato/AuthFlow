// Thin re-export wrapper — handlers moved to `controllers/` for readability
export {
  register,
  login,
  authorize,
  token,
  refresh,
  logout,
  clientToken,
  session,
} from "./controllers/index.js";
