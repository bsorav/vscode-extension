

export class Canvas{
    static MAX_ZOOM = 5;
    static MIN_ZOOM = 0.1;
    static SCROLL_SENSITIVITY = -0.01;

    constructor(canvas, ctx, nodes, edges){
        this.canvas = canvas;
        this.ctx = ctx;
       
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        this.canvas.addEventListener( 'wheel', (e) => this.adjustZoom(e, e.deltaY*Canvas.SCROLL_SENSITIVITY));
        this.nodes = nodes;
        this.edges = edges;
        
        this.scale = 1;
        this.ox = 0;
        this.oy = 0;

        this.mousePressed = false;
        this.prevx = 0;
        this.prevy = 0;
    }

    handleMouseDown(e)
    {
        this.mousePressed = true;
        this.prevx = (e.clientX-this.ox)/this.scale;
        this.prevy = (e.clientY-this.oy)/this.scale;
    }

    handleMouseMove(e)
    {
        if(this.mousePressed)
        {
            let newx = (e.clientX-this.ox)/this.scale;
            let newy = (e.clientY-this.oy)/this.scale;

            let deltax = newx-this.prevx;
            let deltay = newy-this.prevy;

            this.ox += deltax;
            this.oy += deltay;

            this.draw();
        }
    }
    handleMouseUp(e)
    {
        this.mousePressed = false;
    }

    adjustZoom(event, zoomAmount)
    {
        const rect = this.canvas.getBoundingClientRect();
        
        // Screen coordinates
        let newScrX = event.clientX - rect.left;
        let newScrY = event.clientY - rect.top;
        
        // Virtual coordinates
        let newX = - (newScrX - this.ox) / this.scale;
        let newY = - (newScrY - this.oy) / this.scale;

        this.scale = Math.max(Canvas.MIN_ZOOM, Math.min(Canvas.MAX_ZOOM, this.scale + zoomAmount));

        this.ox = newScrX + this.scale * newX;
        this.oy = newScrY + this.scale * newY;

        this.draw();
    }

    zoomCustom(zoomAmount)
    {
        const rect = this.canvas.getBoundingClientRect();
        
        // Screen coordinates
        let newScrX = window.innerWidth/2 - rect.left;
        let newScrY = window.innerHeight/2 - rect.top;
        
        // Virtual coordinates
        let newX = - (newScrX - this.ox) / this.scale;
        let newY = - (newScrY - this.oy) / this.scale;

        this.scale = Math.max(Canvas.MIN_ZOOM, Math.min(Canvas.MAX_ZOOM, this.scale + zoomAmount));

        this.ox = newScrX + this.scale * newX;
        this.oy = newScrY + this.scale * newY;

        this.draw();   
    }

    draw()
    {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Will always clear the right space
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);


        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].draw();
        }
        for (let i = 0; i < this.edges.length; i++) {
            this.edges[i].draw();
        }
        for (let i = 0; i < this.edges.length; i++) {
            this.edges[i].drawEdgeText();
        }
    }
}