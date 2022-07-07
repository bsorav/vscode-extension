/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/


const src_cfg = {
    "nodes" : 
        ["C_3_1", "C_4_20", "C_6_13", "C_8_13", "C_10_13", "C_13_1"],
    "edges" : 
        [
            {
                "from" : "C_3_1",
                "to" : "C_4_20",
                "condition" : "true",
                "statement" : "i := 0"
            },
            {
                "from" : "C_4_20",
                "to" : "C_6_13",
                "condition" : "i < lll",
                "statement" : "X[i] := Y[i] + val"
            },
            {
                "from" : "C_6_13",
                "to" : "C_4_20",
                "condition" : "i < lll",
                "statement" : "X[i] := Y[i] + val"
            },
            {
                "from" : "C_4_20",
                "to" : "C_8_13",
                "condition" : "i < lll",
                "statement" : "X[i] := Y[i] + val"
            },
            {
                "from" : "C_8_13",
                "to" : "C_4_20",
                "condition" : "i < lll",
                "statement" : "X[i] := Y[i] + val"
            },
            {
                "from" : "C_4_20",
                "to" : "C_10_13",
                "condition" : "i < lll",
                "statement" : "X[i] := Y[i] + val"
            },
            {
                "from" : "C_10_13",
                "to" : "C_4_20",
                "condition" : "i < lll",
                "statement" : "X[i] := Y[i] + val"
            },
            {
                "from" : "C_4_20",
                "to" : "C_13_1",
                "condition" : "i < lll",
                "statement" : "X[i] := Y[i] + val"
            }
        ]
};

import { Canvas } from "./canvas.js";
import { Node, Edge, instantiateNodes, highlightPath, deHighlight} from "./graphics.js";


var num_nodes = src_cfg["nodes"].length;
var edges = src_cfg["edges"];
var nodes = src_cfg["nodes"];


var node_to_key = {};
var nodes_names = {};
var adj_lis = new Array(num_nodes);

var key = 0;

for (let i = 0; i < adj_lis.length; i++) {
    adj_lis[i] = [];
    
}

nodes.forEach(element => {
    node_to_key[element] = key;
    key++;
});


edges.forEach(element => {
    adj_lis[node_to_key[element["from"]]].push(node_to_key[element["to"]]); 
});

console.log(adj_lis);

var nodes_obj = instantiateNodes(num_nodes, adj_lis);
for (let i = 0; i < nodes_obj.length; i++) {
    const element = nodes_obj[i];
    element.name = nodes[i];
    nodes_names[element.name] = element;
};


var edges_obj = new Array(edges.length);
var node_to_edge = {};

var canvas = document.getElementById('canvas');
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

var ctx = canvas.getContext('2d');

var canvas_obj = new Canvas(canvas, ctx, nodes_obj, null);

canvas = canvas.getContext('2d');

var from, to;

for (let i = 0; i < edges.length; i++) {
    const element = edges[i];
    from = nodes_obj[node_to_key[element["from"]]];
    to = nodes_obj[node_to_key[element["to"]]];
    edges_obj[i] = new Edge(from, to, "Cond: " + element["condition"], "TF: " + element["statement"], canvas);

    node_to_edge[element["from"] + "," + element["to"]] = edges_obj[i];
}


canvas_obj.edges = edges_obj;

// Marking the back edges

var queue = [0];
var visited = new Array(num_nodes).fill(0);

while(queue.length !== 0)
{
    var node = queue.shift();

    visited[node] = 1;

    for (let i = 0; i < adj_lis[node].length; i++) {
        const element = adj_lis[node][i];
        
        if (visited[element])
        {
            var from = nodes_obj[node];
            var to = nodes_obj[element];
            if (from.pos[0] >= to.pos[0])
            {
                node_to_edge[from.name + "," + to.name].back_edge = true;
            }
            continue;
        }

        queue.push(element);
    }
}

canvas_obj.draw();

window.addEventListener('message', event => {

    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case "highlight":
            highlightPath(message.path, nodes_names, node_to_edge);
            break;
        case "clear":
            deHighlight(nodes_obj, edges_obj);
            canvas_obj.draw();
            break;
        default:
            break;
    }

});

let zoomInButton = document.getElementById("zoomin");
let zoomOutButton = document.getElementById("zoomout");


zoomInButton.onclick = function () {
    canvas_obj.zoomCustom(0.1);
};

zoomOutButton.onclick = function () {
    canvas_obj.zoomCustom(-0.1);
};