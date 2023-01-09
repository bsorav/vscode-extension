/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/

import { highlightPathInGraph, deHighlightGraph} from "./utils.js";

const dst_cfg = {
    "nodes" : 
        ["D_37_1", "D_49_5", "D_106_5", "D_107_5"],
    "edges" : 
        [
            {
                "from" : "D_37_1",
                "to" : "D_49_5",
                "condition" : "true",
                "statement" : "intialize"
            },
            {
                "from" : "D_49_5",
                "to" : "D_106_5",
                "condition" : "true",
                "statement" : "loop body"
            },
            {
                "from" : "D_106_5",
                "to" : "D_49_5",
                "condition" : "loop cond",
                "statement" : "jump to loop body"
            },
            {
                "from" : "D_106_5",
                "to" : "D_107_5",
                "condition" : " ! loop cond",
                "statement" : "ret"
            }
        ]
};

function initializeContainer(){
    let container = document.getElementById('cfg');
    container.style.width = window.innerWidth + 'px';
    container.style.height = window.innerHeight + 'px';
}

function drawNetwork(cfg) {

    var nodeMap = {};
    var idx = 0;
    cfg["nodes"].forEach(element => {
        nodeMap[element] = idx;
        idx++;
    });

    var nodes = new vis.DataSet(cfg["nodes"].map(function(node, idx) {return {id:idx, label:node};}));
    var edges = new vis.DataSet(cfg["edges"].map(function(edge) {return {from:nodeMap[edge.from], to:nodeMap[edge.to], label:"Conditon: " + edge.condition + '\n' + "TF: " + edge.statement};}));

    var network = new vis.Network(document.getElementById('cfg'), {
        nodes: nodes,
        edges: edges
    }, {
        nodes: {
            shape: 'ellipse',
            scaling: {
                label: {
                    enabled: true
                }
            }
        },
        edges: {
            arrows: {
                to: {
                    enabled: true,
                },
            },
            smooth: {
                enabled: true,
                type: "continuous",
                roundness: 0.5,
                forceDirection: "vertical"
            },
            font: {
                align: 'horizontal',
            },
        },
        layout: {
            improvedLayout: true,
            hierarchical: {
                direction: "UD",
                enabled: true,
                levelSeparation: 300,
                nodeSpacing: 200,
                shakeTowards: "leaves"
            }
        },
        physics: {
            enabled: false,
        }
    });

    var edgeMap = {};
    edges = network.body.data.edges.get().map(function(edge) {edgeMap[edge.from + "," + edge.to] = edge.id; return edge.from + "," + edge.to;});
    var s = new Set([]);
    
    edges.forEach(function(edge) {
        var nodes = edge.split(",");
        var rev = [nodes[1], nodes[0]].join(",");

        if(!s.has(rev) && !s.has(edge)){
            s.add(rev);
            s.add(edge);
            network.body.data.edges.update({id:edgeMap[rev], smooth: {enabled: true, type: "curvedCW", roundness: 0.5, forceDirection: "vertical"}});
        }
    });
    return {network:network, nodeMap:nodeMap};
}

initializeContainer();
var res = drawNetwork(dst_cfg);

var network = res.network;
var nodeMap = res.nodeMap;

window.addEventListener('message', function(event) {
    let message = event.data;
    let edgeMap = {};
    let edges = network.body.data.edges.get().map(function(edge) {edgeMap[edge.from + "," + edge.to] = edge.id; return edge;});


    switch (message.command) {
        case "highlight":
            highlightPathInGraph(message.path, dst_cfg.nodes, edgeMap, nodeMap, network);
            break;
        case "clear":
            deHighlightGraph(network);
            break;
        default:
            break;
    }
});
