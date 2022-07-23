/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/
import { highlightPathInGraph, deHighlightGraph} from "./utils.js";

const src_cfg = {
    "nodes" : 
        ["S_3_1", "S_4_20", "S_6_13", "S_8_13", "S_10_13", "S_13_1"],
    "edges" : 
        [
            {
                "from" : "S_3_1",
                "to" : "S_4_20",
                "condition" : "true",
                "statement" : "i := 0"
            },
            {
                "from" : "S_4_20",
                "to" : "S_6_13",
                "condition" : "i < len && d[i] < 0",
                "statement" : ""
            },
            {
                "from" : "S_6_13",
                "to" : "S_4_20",
                "condition" : "true",
                "statement" : "a [i] += b [i] * c [i]"
            },
            {
                "from" : "S_4_20",
                "to" : "S_8_13",
                "condition" : "i < len && d[i] == 0",
                "statement" : ""
            },
            {
                "from" : "S_8_13",
                "to" : "S_4_20",
                "condition" : "true",
                "statement" : "a[i] += b[i] * b[i]"
            },
            {
                "from" : "S_4_20",
                "to" : "S_10_13",
                "condition" : "i < len && d[i] > 0",
                "statement" : ""
            },
            {
                "from" : "S_10_13",
                "to" : "S_4_20",
                "condition" : "true",
                "statement" : "a[i] += c[i] * c[i]"
            },
            {
                "from" : "S_4_20",
                "to" : "S_13_1",
                "condition" : "!(i < len)",
                "statement" : ""
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
            solver: "hierarchicalRepulsion"
        }
    });

    return {network:network, nodeMap:nodeMap};
}

initializeContainer();
var res = drawNetwork(src_cfg);

var network = res.network;
var nodeMap = res.nodeMap;

window.addEventListener('message', function(event) {
    let message = event.data;
    let edgeMap = {};
    let edges = network.body.data.edges.get().map(function(edge) {edgeMap[edge.from + "," + edge.to] = edge.id; return edge;});


    switch (message.command) {
        case "highlight":
            highlightPathInGraph(message.path, src_cfg.nodes, edgeMap, nodeMap, network);
            break;
        case "clear":
            deHighlightGraph(network);
            break;
        default:
            break;
    }
});
