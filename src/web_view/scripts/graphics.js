// Contains nodes and edges class

/* Class conatins
        Properties
        function draw()

*/

export class Node {
    static RADIUS = 25;
    static baseLineX;
    static baseLineY;

    constructor(name, edges, pos, canvas) {
        this.name = name;
        this.edges = edges;
        this.pos = pos; // pos[0] = x; pos[1] = y;
        this.canvas = canvas;
        this.highlighted = false;
    }

    draw() {
        // Circle
        var gradient = this.canvas.createRadialGradient(this.pos[0], this.pos[1], 0, this.pos[0], this.pos[1], Node.RADIUS);
        gradient.addColorStop(0, 'rgb(252, 210, 221, 1)');
        gradient.addColorStop(0.5, 'rgb(252, 192, 208, 1)');
        gradient.addColorStop(1, 'rgb(247, 151, 177, 1)');

        // this.canvas.strokeStyle = 'black';
        this.canvas.fillStyle = gradient;
        // this.canvas.lineWidth = 2;

        this.canvas.beginPath();
        this.canvas.arc(this.pos[0], this.pos[1], Node.RADIUS, 0, 2 * Math.PI);

        // this.canvas.stroke();
        this.canvas.fill();

        // Text
        this.canvas.font = '12px serif';
        this.canvas.fillStyle = 'rgba(0,0,0,1)';
        this.canvas.textAlign = "center";
        this.canvas.textBaseline = "middle";
        this.canvas.fillText(this.name, this.pos[0], this.pos[1]);
        this.canvas.closePath();
    }

    highlight(color) {
        this.canvas.strokeStyle = color;
        this.canvas.lineWidth = 4;

        this.canvas.beginPath();
        this.canvas.arc(this.pos[0], this.pos[1], Node.RADIUS, 0, 2 * Math.PI);

        this.canvas.stroke();
        this.canvas.closePath();
    }
}

export class Edge {
    static drawOptions = { strokeStyle: 'rgb(245, 211, 222, 1)', lineWidth: 3, arrowLen: 8 };

    constructor(from, to, line1, line2, canvas) {
        this.from = from;
        this.to = to;
        this.line1 = line1;
        this.line2 = line2;
        this.back_edge = false;
        this.canvas = canvas;
        this.pos = {};
        this.tcoords = {};
        this.highlighted = false;
        this.hovered = false;
    }

    draw(drawOptions = { ...Edge.drawOptions }) {

        this.canvas.strokeStyle = drawOptions.strokeStyle;
        this.canvas.lineWidth = drawOptions.lineWidth;

        // draw a red line

        var x1 = this.from.pos[0];
        var y1 = this.from.pos[1];

        var x2 = this.to.pos[0];
        var y2 = this.to.pos[1];

        if (this.back_edge) {
            if (x1 === x2 && y1 === y2) {
                var loc = 1;
                var anticlockwise = true;


                var coord1 = coordAtDist(x1, y1, Math.tan(Math.PI / 3), loc * Node.RADIUS);
                var coord2 = coordAtDist(x1, y1, -Math.tan(Math.PI / 3), loc * Node.RADIUS);

                var r1 = Node.RADIUS;
                var r2 = r1 * Math.tan(Math.PI / 3);
                var d = r1 / Math.cos(Math.PI / 3);

                var c = { x: (x1 + d), y: y1 };

                var theta1 = Math.atan((coord1.y - c.y) / (coord1.x - c.x));
                var theta2 = Math.atan((coord2.y - c.y) / (coord2.x - c.x));


                this.canvas.beginPath();
                this.canvas.arc(c.x, c.y, r2, Math.PI + theta1, Math.PI + theta2, anticlockwise);
                this.canvas.stroke();
                this.canvas.closePath();

                drawArrowHead(coord2.x, coord2.y, Math.tan(Math.PI - Math.PI / 3), 1, this.canvas, drawOptions.strokeStyle, drawOptions.arrowLen);

                this.tcoords = {x1:(c.x + r2 + 4), y1:(c.y + 8), x2:(c.x + r2 + 4), y2:(c.y - 8)};

                this.pos = { cx: c.x, cy: c.y, r: r2, theta1: (Math.PI + theta1), theta2: (Math.PI + theta2), dir: anticlockwise };

                return;
            }
            if (x1 > x2) {
                var loc = 1;
                var anticlockwise = true;
            }
            else {
                var loc = -1;
                var anticlockwise = false;
            }
            var m1 = -1 * (x2 - x1) / (y2 - y1);

            var coord1 = coordAtDist(x1, y1, m1, loc * Node.RADIUS);
            var coord2 = coordAtDist(x2, y2, m1, loc * Node.RADIUS);

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

            this.canvas.beginPath();
            this.canvas.arc(c2.x, c2.y, r, theta1, theta2, anticlockwise);
            this.canvas.stroke();
            this.canvas.closePath();

            var dir = (coord2.y - c2.y) / (coord2.x - c2.x);
            drawArrowHead(coord2.x, coord2.y, -1 / dir, loc, this.canvas, drawOptions.strokeStyle, drawOptions.arrowLen);

            // Text Coordinates

            if (loc === -1) {
                this.tcoords = {x1:c1.x, x2:c1.x, y1:(c1.y - 8), y2:(c1.y - 16)};
            }
            else {
                var p = coordAtDist(c2.x, c2.y, m1, loc*(r+8));
                this.tcoords = {x1:p.x, x2:p.x, y1:(p.y + 8), y2:(p.y + 16)};
            }



            this.pos = { cx: c2.x, cy: c2.y, r: r, theta1: (Math.PI + theta1), theta2: (Math.PI + theta2), dir: anticlockwise };

        }
        else {
            if (x2 >= x1) {
                var loc = 1;
            }
            else {
                var loc = -1;
            }
            var m1 = (y2 - y1) / (x2 - x1);
            var coord1 = coordAtDist(x1, y1, m1, loc * Node.RADIUS);
            var coord2 = coordAtDist(x2, y2, m1, -1 * loc * Node.RADIUS);

            this.canvas.beginPath();
            this.canvas.moveTo(coord1.x, coord1.y);
            this.canvas.lineTo(coord2.x, coord2.y);
            this.canvas.stroke();
            this.canvas.closePath();

            drawArrowHead(coord2.x, coord2.y, m1, -loc, this.canvas, drawOptions.strokeStyle, drawOptions.arrowLen);

            var c1 = { x: (2 * coord1.x + 6* coord2.x) / 8, y: (2 * coord1.y + 6* coord2.y) / 8 };
            var c2 = { x: (1 * coord1.x + 7 * coord2.x) / 8, y: (1 * coord1.y + 7 * coord2.y) / 8 };


            // Text Coordinates
            var m2 = -1 / m1;

            var p1 = coordAtDist(c1.x, c1.y, m2, 2);
            var p2 = coordAtDist(c2.x, c2.y, m2, 2);

            this.tcoords = {x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y};

            this.pos = { x1: coord1.x, y1: coord1.y, x2: coord2.x, y2: coord2.y };
        }

    }


    drawEdgeText()
    {
        drawText(this.tcoords.x1, this.tcoords.y1, this.line1, this.canvas, "start", "middle");
        drawText(this.tcoords.x2, this.tcoords.y2, this.line2, this.canvas, "start", "middle");
    }

    hovering(x, y, scale) {

        if (this.back_edge) {
            var dist = distnace(x, y, this.pos.cx, this.pos.cy);
            var delta = 6;
            if (dist <= this.pos.r + delta && dist >= this.pos.r - delta) {
                var theta = angleFromXAxis(this.pos.cx, this.pos.cy, x, y);
                var theta1 = this.pos.theta1;
                var theta2 = this.pos.theta2;
                if (this.pos.dir) {
                    if (theta >= theta1 && theta <= Math.min(2 * Math.PI, theta2) && theta <= this.pos.theta2 && theta >= Math.max(0, theta1)) {
                        return false;
                    }
                    else {
                        return true;
                    }
                }
                else {
                    if (theta <= theta1 && theta >= Math.max(0, theta2) && theta >= theta2 && theta <= Math.min(2 * Math.PI, theta2)) {
                        return false;
                    }
                    else {
                        return true;
                    }
                }
            }
        }
        else {
            var x1 = this.pos.x1;
            var y1 = this.pos.y1;

            var x2 = this.pos.x2;
            var y2 = this.pos.y2;

            var delta = 4;

            if(x1 === x2) {
                if( y >= Math.min(y1, y2) && y <= Math.max(y1, y2) && x >= x1 - delta && x <= x1 + delta) {
                    return true;
                }
                else{
                    return false;
                }
            }

            if(distFromLine(x, y, x1, y1, x2, y2) <= delta) {
                return true;
            }
        }
        return false;
    }

    highlight(color) {
        this.draw({ strokeStyle: color, lineWidth: 4, arrowLen: 12 });
    }
}

function distFromLine(x, y, x1, y1, x2, y2) {
    var m = (y2 - y1) / (x2 - x1);
    var b = y1 - m * x1;
    var dist = Math.abs(m * x - y + b) / Math.sqrt(m * m + 1);
    return dist;
}


function drawArrowHead(x, y, dir, back, canvas, color, len) {
    var baseHalf = len * Math.sin(Math.PI / 4);

    var normal = -1 / dir;

    var baseCen = coordAtDist(x, y, dir, back * baseHalf);

    var coord1 = coordAtDist(baseCen.x, baseCen.y, normal, baseHalf);
    var coord2 = coordAtDist(baseCen.x, baseCen.y, normal, -1 * baseHalf);


    canvas.fillStyle = color;

    canvas.beginPath();
    canvas.moveTo(coord1.x, coord1.y);
    canvas.lineTo(coord2.x, coord2.y);
    canvas.lineTo(x, y);
    canvas.fill();
    canvas.closePath();
    // canvas.stroke();

}

function drawText(x, y, text, ctx, textAlign, textBaseline) {
    ctx.font = '10px serif';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, x, y);
    ctx.closePath();
}



export function deHighlight(nodes_obj, edges_obj) {
    nodes_obj.forEach(element => {
        element.highlighted = false;
    });
    edges_obj.forEach(element => {
        element.highlighted = false;
    });
}

export function instantiateNodes(num_nodes, adj_lis, canvas) {

    const MARGIN = 20;
    const GAP = 150;


    // BFS variables
    var visited = new Array(num_nodes).fill(0);
    var level = new Array(num_nodes).fill(0); // Level of node in BFS tree of CFG (Here level is in x dir)

    var parent = new Array(num_nodes).fill(-1); // Parent of node in BFS tree.

    var queue = [0];
    parent[0] = 0;

    var maxLevel = 0; // Max Level is maximum depth of BFS tree

    while (queue.length !== 0) {
        var node = queue.shift();

        visited[node] = 1;

        for (let i = 0; i < adj_lis[node].length; i++) {
            const element = adj_lis[node][i];

            if (visited[element]) {
                continue;
            }

            level[element] = 1 + level[node];
            maxLevel = Math.max(level[element], maxLevel);
            queue.push(element);

            if (parent[element] === -1) {
                parent[element] = node;
            }
        }

    }

    var numNodesOnLevel = new Array(maxLevel + 1).fill(0); // Number of nodes on each level

    for (let i = 0; i < level.length; i++) {
        const element = level[i];
        numNodesOnLevel[element] += 1;
    }

    var maxWidth = 0; // Maximum number of nodes in a level the BFS tree.

    for (let i = 0; i < numNodesOnLevel.length; i++) {
        const element = numNodesOnLevel[i];
        maxWidth = Math.max(maxWidth, element);
    }

    // // Canvas element on html page
    var canvas = document.getElementById('canvas');

    // // Setting canvas hight and width according to cfg's  maximum width and maximum height 
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const CANVAS_WIDTH = window.innerWidth;
    const CANVAS_HEIGHT = window.innerHeight;

    Node.RADIUS = Math.min(25, (CANVAS_WIDTH - 2 * MARGIN) / (5 * maxWidth));
    Node.RADIUS = Math.min(Node.RADIUS, (CANVAS_HEIGHT - 2 * MARGIN - maxLevel * GAP) / (2 * maxLevel));

    const RADIUS = Node.RADIUS;


    // // canvas variable to draw 2d objects
    canvas = canvas.getContext('2d');

    var baseLineY = Node.baseLineY = CANVAS_HEIGHT / 2 - (2 * RADIUS * (maxLevel + 1) + GAP * maxLevel) / 2; // Y coord at which the start -> end path will be drawn
    var baseLineX = Node.baseLineX = CANVAS_WIDTH / 2;

    var nodes_obj = new Array(num_nodes);  // Contains the Node object for each node in CFG 

    visited = new Array(num_nodes).fill(0);
    var currNode = num_nodes - 1;
    var lis = []; // Contains the nodes on the start -> end path

    // Instantiating nodes on the start -> end path
    var pos;
    while (true) {
        pos = [baseLineX, baseLineY + MARGIN + RADIUS + 2 * RADIUS * (level[currNode]) + GAP * (level[currNode])];
        nodes_obj[currNode] = new Node("N" + currNode, [], pos, canvas);
        visited[currNode] = 1;
        lis.push(currNode);

        if (parent[currNode] === currNode) {
            break;
        }
        currNode = parent[currNode];
    }

    visited = new Array(num_nodes).fill(0);
    var nodes_offset = new Array(num_nodes).fill(0);

    queue = [0];


    // Instantiating Node objects for every other node
    while (queue.length !== 0) {
        const node = queue.shift();
        var disp = 1;

        visited[node] = 1;

        var count = 0;


        for (let i = 0; i < adj_lis[node].length; i++) {
            const element = adj_lis[node][i];
            if (visited[element] || element === node) {
                continue;
            }
            queue.push(element);

            if (lis.includes(element)) {
                continue;
            }
            if (i === 0 && !lis.includes(node)) {
                nodes_offset[element] = 0;
                continue;
            }
            nodes_offset[element] = disp;
            disp = -1 * disp;
            count += 1;
            if (count % 2 === 0) {
                disp += 1;
            }
        }

    }

    queue = [0];
    visited = new Array(num_nodes).fill(0);
    var x, y, gap_at_level;
    while (queue.length !== 0) {
        const node = queue.shift();

        visited[node] = 1;

        for (let i = 0; i < adj_lis[node].length; i++) {
            const element = adj_lis[node][i];
            if (visited[element] || element === node) {
                continue;
            }

            queue.push(element);
            if (lis.includes(element)) {
                continue;
            }
            gap_at_level = (1*(CANVAS_WIDTH - 2 * MARGIN -2*RADIUS*numNodesOnLevel[level[element]]) / numNodesOnLevel[level[element]])/3;

            y = baseLineY + MARGIN + RADIUS + 2 * RADIUS * (level[element]) + GAP * (level[element]);
            x = nodes_obj[node].pos[0] + nodes_offset[element] * gap_at_level;

            nodes_obj[element] = new Node("N" + element, [], [x, y], canvas);
        }

    }

    return nodes_obj;
}



// Helper functions

export function coordAtDist(x, y, slope, dist) {
    var theta = Math.atan(slope);
    // if (theta < 0)
    // {
    //     theta = Math.PI + theta;
    // }
    var xo = x + Math.cos(theta) * dist;
    var yo = y + Math.sin(theta) * dist;
    return { x: xo, y: yo };
}


function distnace(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function angleFromXAxis(x1, y1, x2, y2) {

    var theta = Math.atan((y2 - y1) / (x2 - x1));

    if (x1 <= x2) {
        if (y1 <= y2) {
            return theta;
        }
        else {
            return 2 * Math.PI + theta;
        }
    }
    else {
        if (y1 <= y2) {
            return Math.PI + theta;
        }
        else {
            return Math.PI + theta;
        }
    }
}
