import {Node, angleFromXAxis, coordAtDist} from "./graphics.js";

export var EDGES = [];
export var NODES = [];

export function parseDOTString(fileString)
{
    const lines = fileString.match(/\".*\]/g);
    var nodes = [];
    var edges = [];
    var done = [];

    lines.forEach(element => {
        var temp = element.split(/\->|\[label=\"|\"\]/);
        
        var node1 = temp[0].substring(1, temp[0].length-1);
        var node2 = temp[1].substring(1, temp[1].length-1);
        var label = temp[2].substring(0, temp[2].length-2);
        
        var id1, id2;
        if(!done.includes(node1)){
            done.push(node1);
            id1 = done.length-1;
            nodes.push({id:id1, label:node1});
        }else{
            id1 = done.indexOf(node1);
        }

        if(!done.includes(node2)){
            done.push(node2);
            id2 = done.length-1;
            nodes.push({id:id2, label:node2});
        }else{
            id2 = done.indexOf(node2);
        }
        // console.log({from:[id1, done[id1]], to:[id2, done[id2]],});
        edges.push({from:node1, to:node2, condition:label, statement:label});
    });
    
    return {nodes:done, edges:edges};
}

export function highlightPathInGraph(path, nodes, edgeMap, nodeMap, network) {

    // var canvas = document.getElementById("canvas");
    // var ctx = canvas.getContext('2d');

    EDGES = [];
    NODES = [];

    recPath([], path, 1, false);

    // console.log(EDGES);

    let colorEdges = "rgb(255, 0, 0)";
    let edgeIds = [];

    for (var i = 0; i < EDGES.length; i++) {
        let edge = EDGES[i];
        let from = nodeMap[edge[0]];
        let to = nodeMap[edge[1]];
        let dashed = edge[2];

        // console.log(edge, from , to);

        let edgeIdInNetwork = edgeMap[from + "," + to];
        edgeIds.push(edgeIdInNetwork);

        if(dashed){
            network.body.data.edges.update({id: edgeIdInNetwork, color: {highlight: colorEdges}, dashes: true});
        }
        else{
            network.body.data.edges.update({id: edgeIdInNetwork, color: {highlight: colorEdges}, dashes: false});
        }
    }
    
    var nodeIds = new Set([]);
    
    for(var i = 0; i < NODES.length; i++) {
        var element = NODES[i];
        var nodeName = element[0];
        var unroll = element[1];
        var nodeId = nodeMap[nodeName];
        
        nodeIds.add(nodeId);
        
        let colorNodes = "rgb(255, 0, 0)";
        if(element[1] > 1){
            colorNodes = "rgb(252, 3, 219)";
        }

        network.body.data.nodes.update({id: nodeId, color: {highlight: {border: colorNodes}}});

        // Draw Unroll factor on canvas
        

    }

    nodeIds = Array.from(nodeIds);

    network.setSelection({nodes:nodeIds, edges:edgeIds}, {
        unselectAll: false,
    });

    network.redraw();
}

export function deHighlightGraph(network){
    
    let nodeIds = network.getSelectedNodes();
    let edgeIds = network.getSelectedEdges();

    for(var i = 0; i < nodeIds.length; i++){
        let nodeId = nodeIds[i];
        network.body.data.nodes.update({id: nodeId, color: null});
    }

    for(var i = 0; i < edgeIds.length; i++){
        let edgeId = edgeIds[i];
        network.body.data.edges.update({id: edgeId, color: null, dashes: false});
    }

    network.unselectAll();
    network.redraw();
}

export function highlightPathInCode(canvas, ctx, code, path){
    // canvas -> <canvas> element in HTML DOM
    // ctx -> canvas context
    // code -> <code> element in HTML DOM
    // path -> array of [row, col] in path

    EDGES = [];
    NODES = [];

    recPath([], path, 1, false);

    EDGES.forEach(element => {
        drawEdgeBetweenPoints(element[0], element[1], element[2]);
    });
    
    let scrollHeight = window.scrollHeight;
    let styles = window.getComputedStyle(code);
    let deltaY = parseInt(styles.getPropertyValue("line-height"));
    let topNode = canvas.height*1;

    NODES.forEach(element => {
        drawPointOnNode(element[0], element[1]);
        topNode = Math.min(topNode, element[0].split("_")[1]*1*deltaY);
    });

    window.scroll({left:window.scrollWidth, top:topNode, behavior:'smooth'});
}

function getWithoutBracketedPath(path){
    let len = path.length;

    // Check max bracketed path
    let idx = 1;
    let bracket = 0;
    let bal = true; 
    while(idx < len-1){
        if(path[idx] === "("){
            bracket++;
        }
        if(path[idx] === ")"){
            if(bracket > 0){
                bracket--;
            }
            else{
                bal = false;
                break;
            }
        }
        idx++;
    }
    if(bal && path[0] === "(" && path[len-1] === ")"){
        return path.substring(1, len-1);
    }
    else{
        return path;
    }
}

function splitPathString(path){
    // Split the path into series of subpaths
    // Example: x-(y)^4-(w+z)-(u+v)^2 => [[x, 1], [y, 4], [w+z, 1], [u+v, 2]]

    path = getWithoutBracketedPath(path);

    let lis = [];

    let idx = 0;
    let len = path.length;
    let node = "";
    let depth = 0;

    while(idx < len){
        if(path[idx] === "("){
            depth++;
        }
        else if(path[idx] === ")"){
            depth--;
        }
        node += path[idx];
        idx++;
        // Split condition
        if(depth === 0){
            let found = false;
            if(idx === len){
                lis.push([getWithoutBracketedPath(node), 1]);
                found = true;
            }
            else if(path[idx] === "-"){
                lis.push([getWithoutBracketedPath(node), 1]);
                found = true;
            }
            else if(path[idx] === "^"){
                idx++;
                let num = "";
                while(idx<len && path[idx] !== "-"){
                    num += path[idx];
                    idx++;
                }
                lis.push([getWithoutBracketedPath(node), num * 1]);
                found = true;
            }

            if(found){
                node = "";
                idx++;
            }
        }
    }
    return lis;
}

function splitMultipleControlFlowPathString(path){
    let lis = [];
    let idx = 0;
    let depth = 0;
    let node = "";
    let len = path.length;
    while(idx < len){
        if(path[idx] === "("){
            depth++;
        }
        else if(path[idx] === ")"){
            depth--;
        }
        node += path[idx];
        idx++;
        if(depth === 0){
            let found = false;
            if(idx === len){
                lis.push([getWithoutBracketedPath(node), 1]);
                found = true;
            }
            else if(path[idx] === "+"){
                lis.push([getWithoutBracketedPath(node), 1]);
                found = true;
            }

            if(found){
                node = "";
                idx++;
            }
        }
    }

    return lis;

}

export function recPath(predecessors, path, unroll, dashed){
    // parent is list of predecessors
    // path is series-parallel diagraph of following nodes in parent
    // appends the edges and nodes to `edges` and `nodes` global lists
    // returns lis of last nodes in path

    // console.log(path, unroll, dashed);

    // BASE CASE: path is empty
    if(path.length === 0){
        return;
    }

    // BASE CASE: path is single node
    if(isStandAloneNode(path)){
        // console.log(path);
        predecessors.forEach(element => {
            EDGES.push([element, path, dashed]);
        });

        NODES.push([path, unroll]);
        
        return [path];
    }
    
    
    if(unroll > 1){
        dashed = true;
    }
    // RECURSIVE CASE: path is multiple subpaths(series or parallel)

    // If multiple control flow -> split path into parallel subpaths
    let subpaths = splitMultipleControlFlowPathString(path);

    if(subpaths.length !== 1){
        // console.log(subpaths);
        let successors = [];
        subpaths.forEach(sp => {
            successors = [...new Set([...successors, ...recPath(predecessors, sp[0], unroll, true)])];
        });
        // console.log(successors, path);
        return successors;
    }  

    // Else
    // Split the path into series of subpaths and also specify unroll of each subpath
    subpaths = splitPathString(path);
    // console.log(subpaths);
    // return;


    for (let i = 0; i < subpaths.length; i++) {
        const sp = subpaths[i];

        predecessors = recPath(predecessors, sp[0], i === 0 ? Math.max(unroll, sp[1]) : sp[1], (sp[1] > 1 || unroll > 1) ? true : dashed);
    }
    // console.log(predecessors, path);
    return predecessors;
}

function drawPointOnNode(node, unroll){
    node = node.split("_");

    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7; 
    
    let x1 = (node[2]-1) * 1 * deltaX;
    let y1 = node[1] * 1 * deltaY - deltaY/4;

    let color;
    if(unroll > 1){
        let r = 10;
        color = "rgb(252, 3, 219)";
        drawCircle(ctx, x1, y1, 3, color);
        ctx.lineWidth = 1;
        drawArc(ctx, x1, y1, r, 0, 3*Math.PI/2, false, color, []);
        drawArrowHead(ctx, x1, y1-r, 0, color);
        let x = x1 + r*Math.cos(Math.PI/4);
        let y = y1 - r*Math.sin(Math.PI/4); 
        drawText(ctx, x, y, "" + unroll, color);
    }
    else{
        color = "rgb(255, 0, 0)";
        drawCircle(ctx, x1, y1, 3, color);
    }
}

function drawText(ctx, x, y, text, color){
    ctx.fillStyle = color;
    ctx.font = "16px Arial";
    ctx.fillText(text, x, y);
}

function drawCircle(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawLine(ctx, x1, y1, x2, y2, color, pattern) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.setLineDash(pattern);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.stroke();
}

export function clearCanvas(canvas, ctx){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}


function isStandAloneNode(node){
    let lis = node.split("-");
    return lis.length === 1;
}

function getNextNode(path){
    let idx = 0;
    let node = "";

    if(path[idx] === "("){
        let depth = 0;
        while(path[idx] !== ")" && depth !== 1){
            node += path[idx];

            if(path[idx] === "("){
                depth++;
            }
            else if(path[idx] === ")"){
                depth--;
            }

            idx++;
        }
        node += ")";
    }
    else{
        while(idx < path.length){
            if(path[idx] === "-"){
                break;
            }
            node += path[idx];
            idx++;
        }
    }
    return node;
}

 

function parsePathString(path){
    let idx = 0; 
    let prevNode = null;
    let adjList = {};

    while(true){
        let node = getNextNode(path.substring(idx));
        if(node === null){
            break;
        }

        idx += node.length + 1;



        if(idx >= path.length){
            break;
        } 
    }
}

export function arrayUnique(array) {
    var a = array.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
                a.splice(j--, 1);
        }
    }

    return a;
}

export function convert_long_long_map_json_to_associative_array(long_long_map_json)
{
  var ret = {};
  const pairs = long_long_map_json.long_long_pair;
  if (pairs === undefined) {
    return {};
  }
  for (var i = 0; i < pairs.length; i++) {
    ret[pairs[i].long_val_key] = pairs[i].long_val_value;
  }
  return ret;
}
