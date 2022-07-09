/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/

const prod_cfg = {
    "nodes" : 
        [["C_3_1","A_1_1"], ["C_4_20","A_3_9"], ["C_13_1","A_19_5"]],
    "edges" : 
        [
            {
                "from" : ["C_3_1","A_1_1"],
                "to" : ["C_4_20","A_3_9"],
                "path1" : "C_3_1-C_4_20",
                "path2" : "A_1_1-A_3_9",
            },
            {
                "from" : ["C_4_20","A_3_9"],
                "to" : ["C_4_20","A_3_9"],
                "path1" : "((C_4_20-C_6_13-C_4_20)+(C_4_20-C_8_13-C_4_20)+(C_4_20-C_10_13-C_4_20))^4",
                "path2" : "A_3_9-A_18_9-A_3_9",
            },
            {
                "from" : ["C_4_20","A_3_9"],
                "to" : ["C_13_1","A_19_5"],
                "path1" : "((C_4_20-C_6_13-C_4_20)+(C_4_20-C_8_13-C_4_20)+(C_4_20-C_10_13-C_4_20))^4-C_13_1",
                "path2" : "A_3_9-A_18_9-A_19_5",
            }
        ]
};
const vscode = acquireVsCodeApi();

import { Node, Edge, instantiateNodes} from "./graphics.js";
import {Canvas} from "./canvas.js";


var num_nodes = prod_cfg["nodes"].length;
var edges = prod_cfg["edges"];
var nodes = prod_cfg["nodes"];


var node_to_key = {};
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




var nodes_obj = instantiateNodes(num_nodes, adj_lis);
for (let i = 0; i < nodes_obj.length; i++) {
    const element = nodes_obj[i];
    element.name = nodes[i];
};


var edges_obj = new Array(edges.length);
var node_to_edge = {};

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');;
var canvas_obj = new Canvas(canvas, ctx, nodes_obj, null);
canvas = canvas.getContext('2d');

var from, to;

for (let i = 0; i < edges.length; i++) {
    const element = edges[i];
    from = nodes_obj[node_to_key[element["from"]]];
    to = nodes_obj[node_to_key[element["to"]]];
    edges_obj[i] = new Edge(from, to, element["path1"], element["path2"], canvas);
    
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
            if (from.pos[1] >= to.pos[1])
            {
                node_to_edge[from.name + "," + to.name].back_edge = true;
            }
            continue;
        }
        
        queue.push(element);
    }
}


canvas_obj.draw();

// Event Listeners

window.addEventListener('mousemove', e => {
    for (let i = 0; i < edges_obj.length; i++) {
        const element = edges_obj[i];

        const rect = canvas_obj.canvas.getBoundingClientRect();

        var vx = (e.clientX - canvas_obj.ox - rect.left)/canvas_obj.scale;
        var vy = (e.clientY - canvas_obj.oy - rect.top)/canvas_obj.scale;


        if (element.hovering(vx, vy, canvas_obj.scale))
        {
            if(element.hovered)
            {
                continue;
            }
            vscode.postMessage({
                command:"highlight",
                from:element.from.name,
                to:element.to.name,
                path1:element.line1,
                path2:element.line2
            });

            element.hovered = true;
        }
        else{
            if(element.hovered)
            {
                vscode.postMessage({
                    command:"clear",
                });
            }
            element.hovered = false;
        }
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

