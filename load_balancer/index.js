const net = require('net');
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const servers = [
    { host: 'localhost', port: 8083 },
    { host: 'localhost', port: 8084 },
];

let serverIndex = 0;

// Map to store client address and associated server
const clientServerMap = {};
const serverLoadMap = {};
let maxFree = 0, serverToAssign;

async function pingServers() {
    servers.forEach(server => {
	console.log("Sending data");
        const options = {
            host: server.host,
            port: server.port,
            path: `http://${server.host}:${server.port}/api/eqchecker/server_load`, // returns load info
            method: 'POST',
        };
        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
	    res.on('end', () => {
		let host = server.host;
		let port = server.port;
                try {
		console.log("response received");
                    const loadInfo = JSON.parse(data);
                    let load = loadInfo.freeProcessors; // server returns an object with freeProcessors
		    let serverKey =`${server.host},${server.port}`;
		    console.log("SERVER : ", serverKey);
		    serverLoadMap[serverKey] = load;
		    if(load > maxFree)
			serverToAssign = serverKey;
		    console.log("SERVER LOAD MAP :",serverLoadMap);
		    console.log("Free processors: ", load);
                } catch (error) {
                    console.error('Error parsing load info:', error);
                }
            });
        });
        req.on('error', error => {
            console.error('Error pinging server:', error);
        });
        req.end();
    });
}

setInterval(pingServers, 5000);


function getServerForClient(directory) {
	console.log("Client Server Map: ",clientServerMap);
    if(directory){
    	directory = path.dirname(directory);
    	console.log("Directory received: " , directory);
    }
    if (clientServerMap[directory]) {    // server has already been allocated to this directoryPath
	console.log("Already mapped dirPath");
        return clientServerMap[directory];
    } else {
        // If directory is different or directory is null, assign a new server
	console.log("New request");
        //serverIndex = (serverIndex + 1) % servers.length;
	//console.log("Server index : ", serverIndex);
	
        const server = serverToAssign; //servers[serverIndex];
        //clientServerMap[directory] = server;
        return server;
    }
}

const app = express();

app.use(express.json());
app.use(cors());

app.post('/api/eqchecker/submit_eqcheck', async (req, res) => {
    console.log("Recieved client request ");
    let dirPath;
    const requestBody = req.body;
	//console.log("Request Address : " , requestBody);
    if (!requestBody.dirPathIn && !requestBody.prepareDirpath) {
	console.log("It is a new request ");
        // it is a fresh request 
	dirPath = null;
    }
    else{
	console.log("It is a ping");
	if(requestBody.dirPathIn)
	    dirPath = requestBody.dirPathIn;
	if(requestBody.prepareDirpath)
	    dirPath = requestBody.prepareDirpath;
    }
	console.log("Request received with dirPath : ", dirPath);
    const server = getServerForClient(dirPath);
    try {
        forwardRequestToBackend(server, requestBody).then(response => {
        res.send(response);
	console.log("Sending request back to the client");
	});
    } catch (error) {
        console.error('Error in proxy request:', error);
        res.status(500).send('Internal server error.');
    }
});

function forwardRequestToBackend(server, requestBody) {
    console.log("Forwarding to server :", server);
    return new Promise((resolve, reject) => {
        const options = {
            host: server.host,
            port: server.port,
            path: `http://${server.host}:${server.port}/api/eqchecker/submit_eqcheck`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        };
        const backendRequest = http.request(options, backendResponse => {
	    let directory;
            let responseData = '';
            backendResponse.on('data', chunk => {
                responseData += chunk;
            });
            backendResponse.on('end', () => {
                try {
                    const responseJson = JSON.parse(responseData);
                    // Extract dirPath from the response JSON
  		    if(responseJson.dirPath)
		    {
                    	const dirPath = responseJson.dirPath
		    	console.log("DIRPATH : " , dirPath);
        		directory = path.dirname(dirPath);
			if(!clientServerMap[directory]){
        			console.log("Mapping: " , directory, "to ", server);
		    		clientServerMap[directory] = server;
			}
//	            console.log("Client server map , key : ", dirPath, "Value : ", clientServerMap[dirPath]);
		    }
		    resolve(responseData);
                } catch (error) {
                    reject(error);
                }
            });
        });
        backendRequest.on('error', error => {
            reject(error);
        });
        // Write the request body and end the request
        backendRequest.write(JSON.stringify(requestBody));
        backendRequest.end();
	console.log("Sent to backend");
    });
}

const PORT = 8082;
const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`HTTP load balancer listening on port ${PORT}`);
});

