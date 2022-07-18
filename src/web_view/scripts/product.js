/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/

// var prod_cfg = {
//     "nodes": [["S_1_1", "D_1_1"], ["S_6_15", "D_9_20"], ["S_6_15", "D_22_29"], ["S_8_1", "D_36_1"]],
//     "edges": [
//         {
//             "from": ["S_1_1", "D_1_1"],
//             "to": ["S_6_15", "D_9_20"],
//             "path1": "S_1_1-S_6_15", 
//             "path2":"D_1_1-D_9_20"
//         },
//         {
//             "from": ["S_6_15", "D_9_20"],
//             "to": ["S_6_15", "D_9_20"],
//             "path1": "S_6_15-S_6_19-S_6_15", 
//             "path2":"D_9_20-D_10_9-D_9_70-D_9_20"
//         },
//         {   
//             "from": ["S_6_15", "D_9_20"],
//             "to": ["S_6_15", "D_22_29"],
//             "path1": "S_6_15-S_6_15",
//             "path2" : "D_9_20-D_12_1-D_22_29"
//         },
//         {
//             "from": ["S_6_15", "D_22_29"],
//             "to" : ["S_6_15", "D_22_29"],
//             "path1": "(S_6_15-S_6_19-S_6_15)^4",
//             "path2": "((D_22_29-D_23_9-D_20_1-D_22_29)+(D_22_29-D_23_9-D_24_40-D_25_11-D_26_11-D_26_11-D_27_11-D_27_11-D_28_11-D_28_11-D_29_11-D_29_11-D_30_11-D_30_11-D_31_11-D_31_11-D_32_11-D_32_11-D_20_1-D_22_29))"
//         },
//         {
//             "from": ["S_6_15", "D_22_29"],
//             "to": ["S_8_1", "D_36_1"],
//             "path1": "(S_6_15-S_6_19-S_6_15)^4-S_7_11-S_8_1",
//             "path2": " D_22_29-D_23_9-((D_25_11-((D_26_11-((D_27_11-((D_28_11-((D_29_11-((D_30_11-((D_31_11-D_32_11-D_32_11-D_32_33-D_35_1)+(D_32_11-D_31_33-D_35_1)))+(D_31_11-D_30_33-D_35_1)))+(D_30_11-D_29_33-D_35_1)))+(D_29_11-D_28_33-D_35_1)))+(D_28_11-D_27_33-D_35_1)))+(D_27_11-D_26_33-D_35_1)))+(D_26_11-D_25_33-D_35_1))-D_36_1"
//         },
//         {
//             "from": ["S_6_15", "D_9_20"],
//             "to": ["S_8_1", "D_36_1"],
//             "path1": "((S_6_15-S_6_19-S_6_15)+(S_6_15))-S_7_11-S_8_1",
//             "path2": "D_9_20-D_10_11-D_10_11-D_11_17-D_35_1-D_36_1"
//         }
//     ]
// };;

const prod_cfg = {
    "nodes" : 
        [["S_3_1","D_37_1"], ["S_4_20","D_49_5"], ["S_13_1","D_107_5"]],
    "edges" : 
        [
            {
                "from" : ["S_3_1","D_37_1"],
                "to" : ["S_4_20","D_49_5"],
                "path1" : "S_3_1-S_4_20",
                "path2" : "D_37_1-D_49_5",
            },
            {
                "from" : ["S_4_20","D_49_5"],
                "to" : ["S_4_20","D_49_5"],
                "path1" : "((S_4_20-S_6_13-S_4_20)+(S_4_20-S_8_13-S_4_20)+(S_4_20-S_10_13-S_4_20))^4",
                "path2" : "D_49_5-D_106_5-D_49_5",
            },
            {
                "from" : ["S_4_20","D_49_5"],
                "to" : ["S_13_1","D_107_5"],
                "path1" : "((S_4_20-S_6_13-S_4_20)+(S_4_20-S_8_13-S_4_20)+(S_4_20-S_10_13-S_4_20))^4-S_13_1",
                "path2" : "D_49_5-D_106_5-D_107_5",
            }
        ]
};

// window.addEventListener('message', async event => {
//     const messgae = event.data;
//     prod_cfg = messgae;
//     console.log(prod_cfg);
// });


// async function waitForMessage(){
//     // console.log(prod_cfg);
//     while(prod_cfg === null){
//         await new Promise(r => window.setTimeout(r, 100));
//     }
// }

// await waitForMessage();


const vscode = acquireVsCodeApi();

await vscode.onR

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

