/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/

const dst_cfg = {
    "nodes" : 
        ["A6", "A17", "A20", "A34", "A22", "EA"],
    "edges" : 
        [
            {
                "from" : "A6",
                "to" : "A17",
                "condition" : "true",
                "statement" : "-4(%esp) := %ebp\r\n%esp := %esp - 4\r\n\r\n%ebp := %esp\r\n\r\n%esp := %esp - 16"
            },
            {
                "from" : "A17",
                "to" : "A20",
                "condition" : "true",
                "statement" : "-4(%ebp) := 0"
            },
            {
                "from" : "A20",
                "to" : "A34",
                "condition" : "true",
                "statement" : ""
            },
            {
                "from" : "A34",
                "to" : "A22",
                "condition" : "-4(%ebp) < 31999",
                "statement" : ""
            },
            {
                "from" : "A22",
                "to" : "A34",
                "condition" : "true",
                "statement" : "%eax := -4(%ebp)\r\n%edx := (Y + 4*%eax)\r\n%eax := val\r\n%edx := %edx + %eax\r\n%eax := -4(%ebp)\r\n(X + 4*%eax) := %edx\r\n-4(%ebp) := -4(%ebp) + 1"
            },
            {
                "from" : "A34",
                "to" : "EA",
                "condition" : "!(-4(%ebp) < 31999)",
                "statement" : "%eax := 0\r\nleave"
            }
        ]
};

import { Node, Edge, instantiateNodes} from "./graphics.js";


var num_nodes = dst_cfg["nodes"].length;
var edges = dst_cfg["edges"];
var nodes = dst_cfg["nodes"];


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

for (let i = 0; i < edges_obj.length; i++) {
    edges_obj[i].draw();
}


window.addEventListener('message', event => {

    const message = event.data; // The JSON data our extension sent
    console.log(message);
});



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