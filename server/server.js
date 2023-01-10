var express = require('express');
var app = express();
var cors = require("cors");

//var corsOptions = {
//    origin: 'http://localhost:8080',
//    optionsSuccessStatus: 200, // For legacy browser support
//    methods: "GET, PUT"
//}

//app.use(cors(corsOptions));
app.use(cors());
app.use("/", function (req, res) {
  res.json({ result: 'Equivalence checker not installed yet' });
});
var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});
