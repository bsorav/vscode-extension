import {angleFromXAxis, coordAtDist} from "./graphics.js";

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

export function highlightPathInCode(canvas, ctx, code, path){
    // canvas -> <canvas> element in HTML DOM
    // ctx -> canvas context
    // code -> <code> element in HTML DOM
    // path -> array of [row, col] in path

    recPath([], path);
}

function splitPathString(path){
    let lis = [];
    let idx = 0;

    let normal = true;
    for (let i = 0; i < path.length; i++) {
        if(path[i] === "+"){
            normal = false;
            break;
        }
    }

    if(normal){
        id(path[0] === "(")
        return path.substring(1, path.length-1).split("-");
    }

    while(idx < path.length){
        if(path[idx] === "("){
            let depth = 0;
            let node = "";
            while(!(path[idx] === ")" && depth === 1)){
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
            idx++;
            lis.push(node);
        }
        else{
            let node = "";
            while(idx < path.length){
                if(path[idx] === "-"){
                    break;
                }
                node += path[idx];
                idx++;
            }
            lis.push(node);
        }
        if(idx < path.length && path[idx] === "-"){
            idx++;
        }
        else{
            while(idx < path.length && path[idx] !== "-"){ 
                idx++;
            }
            idx++;
        }
    }

    return lis;
}

function splitMultipleControlFlowPathString(path){
    let lis = [];
    let idx = 1;
    let depth = 0;
    let node = "";
    while(idx < path.length){
        if(path[idx] === "("){
            depth++;
        }
        else if(path[idx] === ")"){
            depth--;
        }
        node += path[idx];
        idx++;
        if(depth === 0 && (path[idx] === "+" || path[idx] === ")")){
            lis.push(node);
            node = "";
            depth = 0;
            while(idx < path.length && path[idx] !== "+"){
                idx++;
            }
            idx++;
        }
    }

    return lis;

}

function recPath(parent, path){
    // parent is list of predecessors
    // path is series-parallel diagraph of following nodes in parent


    if(path ===  ""){
        return [];
    }

    let lis = splitPathString(path);
    // console.log(lis);

    if(lis.length === 1 && !isStandAloneNode(lis[0])){
        lis = splitMultipleControlFlowPathString(path);
        // console.log(lis);
        // console.log("FFFF");
        let successors = [];

        if(parent.length === 0){
            for (let i = 0; i < lis.length; i++) {
                const element = lis[i];
                if(isStandAloneNode(element)){
                    successors = [...new Set([...successors, element])];
                }
                else{
                    successors = [...new Set([...successors, ...recPath([], element)])];
                }
            }
        }
        else{
            for (let i = 0; i < parent.length; i++) {
                const p = parent[i];
                for (let j = 0; j < lis.length; j++) {
                    const element = lis[j];
                    if(isStandAloneNode(element)){
                        // Draw edge between p and element
                        drawEdgeBetweenPoints(p, element);
                        successors = [...new Set([...successors, element])];
                    }
                    else{
                        successors =  [...new Set([...successors, ...recPath([p], element)])];
                    }
                }
            }
        }
        // console.log(lis, successors);
        return successors;
    }
    let nextParents = parent;



    
    for (let i = 0; i < lis.length; i++) {
        const element = lis[i];
        for (let j = 0; j < nextParents.length; j++) {
            const p = nextParents[j];
            if(isStandAloneNode(element)){
                // Draw Edge between p and element (p is predecessor)
                drawEdgeBetweenPoints(p, element);
                nextParents = [element];
            }
            else{
                nextParents = recPath(nextParents, element);
                break;
            }
        }
        if(nextParents.length === 0){
            if(isStandAloneNode(element)){
                nextParents = [element];
            }
            else{
                nextParents = recPath(nextParents, element);
            }
        }
    }   
    // console.log(lis, nextParents);
    return nextParents;

}

function drawEdgeBetweenPoints(node1, node2){
    // node1 is predecessor
    // node2 is successor
    // Draw edge between node1 and node2


    node1 = node1.split("_");
    node2 = node2.split("_");

    let canvas = document.getElementById("canvas");
    let ctx = canvas.getContext("2d");

    let styles = window.getComputedStyle(document.getElementById("code"));

    let deltaY = styles.lineHeight.replace("px", "") * 1;
    let deltaX = document.getElementById("code").children[0].getBoundingClientRect().width/document.getElementById("code").children[0].textContent.length;

    let x1 = (node1[2]-1) * 1 * deltaX;
    let y1 = node1[1] * 1 * deltaY - deltaY/4;
    let x2 = (node2[2]-1) * 1 * deltaX;
    let y2 = node2[1] * 1 * deltaY - deltaY/4;

    let color1 = 'rgb(255, 0, 0)';
    let color2 = 'rgb(52, 58, 235, 0.8)';
    let theta = angleFromXAxis(x1, y1, x2, y2);
    
    if(x1 === x2 && y1 === y2){
        let radius = deltaX*3;
        drawCircle(x1, y1, 2, color1);
        drawArc(ctx, x1 + radius, y1, radius, 0, 2*Math.PI, false, color2);
        drawArrowHead(ctx, x1 + radius, y1, 3*Math.PI/2, color1);
        drawCircle(x2, y2, 2, color1);
        return;
    }

    if(y1 > y2){
        if (x1 > x2) {
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
        dist = Math.tan(1.309) * dist / 2;
        var c1 = { x: (coord1.x + coord2.x) / 2, y: (coord1.y + coord2.y) / 2 };


        var c2 = coordAtDist(c1.x, c1.y, m1, -1 * loc * dist);

        var theta1 = Math.atan((coord1.y - c2.y) / (coord1.x - c2.x));
        var theta2 = Math.atan((coord2.y - c2.y) / (coord2.x - c2.x));
        var r = Math.sqrt((coord1.x - c2.x) ** 2 + (coord1.y - c2.y) ** 2);

        if (loc === -1) {
            theta1 = Math.PI + theta1;
            theta2 = Math.PI + theta2;
        }

        var p = coordAtDist(c1.x, c1.y, m1, loc * (r - dist));

        var ntheta = angleFromXAxis(c2.x, c2.y, p.x, p.y);
        if(loc === -1){
            ntheta = Math.PI/2 + ntheta;
        }
        else{
            ntheta = 3*Math.PI/2 + ntheta;
        }

        drawCircle(ctx, x1, y1, 2, color1);
        drawArc(ctx, c2.x, c2.y, r, theta1, theta2, anticlockwise, color2);
        drawArrowHead(ctx, p.x, p.y, ntheta, color1);
        drawCircle(ctx, x2, y2, 2, color1);

    }
    else if(y1 < y2){
        drawCircle(ctx, x1, y1, 2, color1);
        drawLine(ctx, x1, y1, x2, y2, color2);
        drawArrowHead(ctx, (x1+x2)/2, (y1+y2)/2, theta, color1);
        drawCircle(ctx, x2, y2, 2, color1);
    }
    
}

function drawCircle(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawLine(ctx, x1, y1, x2, y2, color) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.stroke();
}

function drawArc(ctx, cx, cy, radius, theta1, theta2, anticlockwise, color) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, theta1, theta2, anticlockwise);
    ctx.strokeStyle = color;
    ctx.stroke();
}


function drawArrowHead(ctx, x, y, theta, color) {

    let len = 8;
    let baseHalf = len * Math.sin(Math.PI / 4);
    
    let dir = Math.tan(theta);
    let normal = -1 / dir;

    if(theta < Math.PI/2 || theta > Math.PI * 3/2){
        var back = -1;
    }
    else{
        var back = 1;
    }

    let baseCen = coordAtDist(x, y, dir, back * baseHalf);

    let coord1 = coordAtDist(baseCen.x, baseCen.y, normal, baseHalf);
    let coord2 = coordAtDist(baseCen.x, baseCen.y, normal, -1 * baseHalf);


    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(coord1.x, coord1.y);
    ctx.lineTo(coord2.x, coord2.y);
    ctx.lineTo(x, y);
    ctx.fill();
    ctx.closePath();
}

export function clearCanvas(canvas, ctx){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}


function isStandAloneNode(node){
    return node[0] !== "(" && node[node.length-1] !== ")";
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