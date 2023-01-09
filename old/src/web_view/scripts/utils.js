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

function drawEdgeBetweenPoints(node1, node2, dashed){
    // node1 is predecessor
    // node2 is successor
    // Draw edge between node1 and node2

    let pattern = [];
    if(dashed){
        pattern = [4, 2];
    }



    node1 = node1.split("_");
    node2 = node2.split("_");

    
    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");
    
    let styles = window.getComputedStyle(document.getElementById("code"));
    
    let deltaY = styles.lineHeight.replace("px", "") * 1;
    let deltaX = styles.fontSize.replace("px", "") * 1 * 3/7;
    
    // console.log(node2);
    if(node1[0] === "start"){
        node1 = ["start", 1, 1];
    }
    else if(node1[0] === "end"){
        node1 = ["end", canvas.height/deltaY, 1];
    }

    if(node2[0] === "start"){
        node2 = ["start", 1, 1];
    }
    else if(node2[0] === "end"){
        node2 = ["end", canvas.height/deltaY, 1];
    }

    if(node1.length === 2){
        node1.push(2);
    }
    if(node2.length === 2){
        node2.push(2);
    }

    let x1 = (node1[2]-1) * 1 * deltaX;
    let y1 = node1[1] * 1 * deltaY - deltaY/4;
    let x2 = (node2[2]-1) * 1 * deltaX;
    let y2 = node2[1] * 1 * deltaY - deltaY/4;

    let color1 = 'rgb(255, 0, 0)';
    let color2 = 'rgb(52, 58, 235, 0.8)';
    let theta = angleFromXAxis(x1, y1, x2, y2);
    
    if(x1 === x2 && y1 === y2){
        let radius = deltaX*3;
        // drawCircle(x1, y1, 2, color1);
        drawArc(ctx, x1 + radius, y1, radius, 0, 2*Math.PI, false, color2, pattern);
        drawArrowHead(ctx, x1 + 2*radius, y1, 3*Math.PI/2, color1);
        // drawCircle(x2, y2, 2, color1);
        return;
    }

    if(y1 > y2 || (y1 === y2 && x1 > x2)){
        if (x1 >= x2) {
            var loc = 1;
            var anticlockwise = true;
        }
        else {
            var loc = -1;
            var anticlockwise = false;
        }
        var m1 = -1 * (x2 - x1) / (y2 - y1);

        var coord1 = {x:x1, y:y1};
        var coord2 = {x:x2, y:y2};

        var dist = Math.sqrt((coord1.x - coord2.x) ** 2 + (coord1.y - coord2.y) ** 2);
        if(dist < 30){
            dist = 0;
        }
        else{
            dist = Math.tan(1.309) * dist / 2;
        }
        var c1 = { x: (coord1.x + coord2.x) / 2, y: (coord1.y + coord2.y) / 2 };


        var c2 = coordAtDist(c1.x, c1.y, m1, -1 * loc * dist);

        if(y1 === y2){
            c2 = {x: c1.x, y: c1.y + loc*dist};
        }

        var theta1 = Math.atan((coord1.y - c2.y) / (coord1.x - c2.x));
        var theta2 = Math.atan((coord2.y - c2.y) / (coord2.x - c2.x));
        var r = Math.sqrt((coord1.x - c2.x) ** 2 + (coord1.y - c2.y) ** 2);

        if (loc === -1) {
            theta1 = Math.PI + theta1;
            theta2 = Math.PI + theta2;
        }
        theta1 = angleFromXAxis(c2.x, c2.y, coord1.x, coord1.y);
        theta2 = angleFromXAxis(c2.x, c2.y, coord2.x, coord2.y);

        var p = coordAtDist(c1.x, c1.y, m1, loc * (r - dist));

        if(y1 === y2){
            p = {x:c2.x, y:(c2.y - r)};
        }

        var ntheta = angleFromXAxis(c2.x, c2.y, p.x, p.y);
        if(loc === -1){
            ntheta = Math.PI/2 + ntheta;
        }
        else{
            ntheta = ntheta - Math.PI/2;
        }

        // drawCircle(ctx, x1, y1, 2, color1);
        drawArc(ctx, c2.x, c2.y, r, theta1, theta2, anticlockwise, color2, pattern);
        drawArrowHead(ctx, p.x, p.y, ntheta, color1);
        // drawCircle(ctx, x2, y2, 2, color1);

    }
    else if(y1 <= y2){
        // drawCircle(ctx, x1, y1, 2, color1);
        drawLine(ctx, x1, y1, x2, y2, color2, pattern);
        drawArrowHead(ctx, (x1+x2)/2, (y1+y2)/2, theta, color1);
        // drawArrowHead(ctx, x1, y1, theta, color1);
        // drawArrowHead(ctx, x2, y2, theta, color1);
        // drawCircle(ctx, x2, y2, 2, color1);
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

function drawArc(ctx, cx, cy, radius, theta1, theta2, anticlockwise, color, pattern) {
    ctx.beginPath();
    ctx.setLineDash(pattern);
    ctx.arc(cx, cy, radius, theta1, theta2, anticlockwise);
    ctx.strokeStyle = color;
    ctx.stroke();
}


function drawArrowHead(ctx, x, y, theta, color) {

    let h = 10;
    let w = 8;
    
    let dir = Math.tan(theta);
    let normal = -1 / dir;

    if(theta <= Math.PI/2 || theta > Math.PI * 3/2){
        var back = -1;
    }
    else{
        var back = 1;
    }


    let baseCen = coordAtDist(x, y, dir, back * h/2);
    let baseStart = coordAtDist(x, y, dir, -1 * back * h/2);

    let coord1 = coordAtDist(baseCen.x, baseCen.y, normal, w/2);
    let coord2 = coordAtDist(baseCen.x, baseCen.y, normal, -1 * w/2);


    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(coord1.x, coord1.y);
    ctx.lineTo(coord2.x, coord2.y);
    ctx.lineTo(baseStart.x, baseStart.y);
    ctx.fill();
    ctx.closePath();
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