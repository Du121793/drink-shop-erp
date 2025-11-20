const getFormattedDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const info = (msg, actor = "系統", ip = "") => {
  const ipPart = ip ? `[${ip}]` : "";
  console.log(`[INFO][${actor}]${ipPart}[${getFormattedDate()}] ${msg}`);
};

const error = (err, req = null, actor = "系統") => {
  const ip = req ? `[${req.ip}]` : "";
  const data = req && req.body ? `[傳入資料: ${JSON.stringify(req.body)}]` : "";
  const errorMessage = `
[ERROR][${actor}]${ip}[${getFormattedDate()}]${data}
錯誤簡述: "${err.msg}"
詳細錯誤:
`;
  console.error(errorMessage, err);
};

const warn = (msg, actor = "系統", ip = "") => {
  const ipPart = ip ? `[${ip}]` : "";
  console.log(`[WARN][${actor}]${ipPart}[${getFormattedDate()}] ${msg}`);
};

export { info, error, warn };
