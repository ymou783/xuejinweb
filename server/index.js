const http = require("node:http");
const { openDatabase } = require("./db");
const { handleRequest } = require("./routes");

const port = Number(process.env.PORT || 3000);

openDatabase();

const server = http.createServer(handleRequest);
server.listen(port, () => {
  console.log(`雪烬电竞服务已启动: http://localhost:${port}`);
});
