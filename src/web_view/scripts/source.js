/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/

const src_cfg = {
    "nodes" : 
        ["C3", "C9", "C10", "EC"],
    "edges" : 
        [
            {
                "from" : "C3",
                "to" : "C9",
                "condition" : "true",
                "statement" : "i := 0"
            },
            {
                "from" : "C9",
                "to" : "C10",
                "condition" : "i < lll",
                "statement" : "X[i] := Y[i] + val"
            },
            {
                "from" : "C10",
                "to" : "C9",
                "condition" : "true",
                "statement" : "i++"
            },
            {
                "from" : "C9",
                "to" : "EC",
                "condition" : "!(i < lll)",
                "statement" : ""
            }
        ]
};

import { Node, Edge, instantiateNodes} from "./graphics.js";


var num_nodes = src_cfg["nodes"].length;
var edges = src_cfg["edges"];
var nodes = src_cfg["nodes"];


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

console.log(adj_lis);

var nodes_obj = instantiateNodes(num_nodes, adj_lis);
for (let i = 0; i < nodes_obj.length; i++) {
    const element = nodes_obj[i];
    element.name = nodes[i];
};

for (let i = 0; i < nodes_obj.length; i++) {
    nodes_obj[i].draw();
}

var edges_obj = new Array(edges.length);
var node_to_edge = {};

var canvas = document.getElementById('canvas');
canvas = canvas.getContext('2d');

var from, to;

for (let i = 0; i < edges.length; i++) {
    const element = edges[i];
    from = nodes_obj[node_to_key[element["from"]]];
    to = nodes_obj[node_to_key[element["to"]]];
    edges_obj[i] = new Edge(from, to, element["path1"], element["path2"], canvas);

    node_to_edge[element["from"] + "," + element["to"]] = edges_obj[i];
}


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
            node_to_edge[nodes_obj[node].name + "," + nodes_obj[element].name].back_edge = true;
            continue;
        }

        queue.push(element);
    }
}

for (let i = 0; i < edges_obj.length; i++) {
    edges_obj[i].draw();
}





// function srcViewDisplayToggle() {
//     // Get the checkbox
//     var checkBox = document.getElementById("src-toggle");
//     // Get the output text
//     var div1 = document.getElementById("src-code-div");
//     var div2 = document.getElementById("src-cfg-div");
  
//     // If the checkbox is checked, display the output text
//     if (checkBox.checked == true){
//         div2.style.display = "block";
//         div1.style.display = "none";
//     } else {
//         div2.style.display = "none";
//         div1.style.display = "block";
//     }
// }

// function dstViewDisplayToggle() {
//     // Get the checkbox
//     var checkBox = document.getElementById("dst-toggle");
//     // Get the output text
//     var div1 = document.getElementById("dst-code-div");
//     var div2 = document.getElementById("dst-cfg-div");
  
//     // If the checkbox is checked, display the output text
//     if (checkBox.checked == true){
//         div2.style.display = "block";
//         div1.style.display = "none";
//     } else {
//         div2.style.display = "none";
//         div1.style.display = "block";
//     }
// }