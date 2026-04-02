"use strict";

var main = () => {
    var canvasEl            = document.getElementById("canvas");
    var pxSzSliderEl        = document.getElementById("pixel-size-slider");
    var pxSzValueEl         = document.getElementById("pixel-size-slider-value");
    var resetPointsButtonEl = document.getElementById("reset-points-button");

    var ctx = canvasEl.getContext("2d", {alpha: false});

    var pxSz    = Number(pxSzValueEl.value); // pixel size
    var pxSzMin = Number(pxSzValueEl.min);
    var pxSzMax = Number(pxSzValueEl.max);
    if (pxSz !== 1) {
        // See https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look#crisp_pixel_art_in_canvas
        canvasEl.style.imageRendering = "pixelated";
    }
    var w = Math.floor(document.body.clientWidth  / pxSz);
    var h = Math.floor(document.body.clientHeight / pxSz);

    canvasEl.width  = w;
    canvasEl.height = h;
    canvasEl.style.width  = `${w * pxSz}px`;
    canvasEl.style.height = `${h * pxSz}px`;

    var imageData        = new ImageData(w, h);
    var imageDataU32View = new Uint32Array(imageData.data.buffer);

    var isLittleEndian = true;
    {
        const u32Array = new Uint32Array(1);
        u32Array[0] = 0x11223344;
        isLittleEndian = (new Uint8Array(u32Array.buffer))[0] == 0x44;
    }

    var clearImageData = () => imageDataU32View.fill(0xFF000000);
    if (!isLittleEndian)
        clearImageData = () => imageDataU32View.fill(255);

    var GREEN   = 0x00FF00;
    var BLUE    = 0x0000FF;
    var MAGENTA = 0xFF00FF;
    var YELLOW  = 0xFFFF00;

    var setPx = (x, y, rgb, alpha) => {
        if (x >= 0 && x < w && y >= 0 && y < h) {
            const r =  rgb>>16;
            const g = (rgb>> 8) & 255;
            const b =  rgb      & 255;
            const i = y*w + x;
            if (alpha === 255) {
                imageDataU32View[i] = r | (g<<8) | (b<<16) | 0xFF000000;
            } else {
                const oldFac = 255 - alpha;
                const oldVal = imageDataU32View[i];
                const oldR =  oldVal      & 255;
                const oldG = (oldVal>> 8) & 255;
                const oldB = (oldVal>>16) & 255;
                imageDataU32View[i] =
                     ((r*alpha + oldR*oldFac)>>8)      |
                    (((g*alpha + oldG*oldFac)>>8)<< 8) |
                    (((b*alpha + oldB*oldFac)>>8)<<16) | 0xFF000000;
            }
        }
    };
    if (!isLittleEndian) {
        setPx = (x, y, rgb, alpha) => {
            if (x >= 0 && x < w && y >= 0 && y < h) {
                const r =  rgb>>16;
                const g = (rgb>> 8) & 255;
                const b =  rgb      & 255;
                const i = y*w + x;
                if (alpha === 255) {
                    imageDataU32View[i] = (r<<24) | (g<<16) | (b<<8) | 255;
                } else {
                    const oldFac = 255 - alpha;
                    const oldVal = imageDataU32View[i];
                    const oldR = (oldVal>>24) & 255;
                    const oldG = (oldVal>>16) & 255;
                    const oldB = (oldVal>> 8) & 255;
                    imageDataU32View[i] =
                        (((r*alpha + oldR*oldFac)>>8)<<24) |
                        (((g*alpha + oldG*oldFac)>>8)<<16) |
                        (((b*alpha + oldB*oldFac)>>8)<< 8) | 255;
                }
            }
        };
    }

    var drawLine = (x1, y1, x2, y2, rgb, alpha) => {
        // From Alois Zingl's implementation of Bresenham's algorithm.
        // Found on their website https://zingl.github.io/bresenham.html
        // and described in their paper "A Rasterizing Algorithm for Drawing Curves"
        // ("Listing 2: Program to plot a line", on page 13).
        var dx = x2 - x1;
        var dy = y1 - y2;
        var sx = 1;
        var sy = 1;
        if (dx < 0) { dx = -dx; sx = -sx; }
        if (dy > 0) { dy = -dy; sy = -sy; }
        var e = dx + dy;
        while (x1 !== x2 || y1 !== y2) {
            setPx(x1, y1, rgb, alpha);
            const e2 = e<<1;
            if (e2 >= dy) { x1 += sx; e += dy; }
            if (e2 <= dx) { y1 += sy; e += dx; }
        }
        setPx(x1, y1, rgb, alpha);
    };

    var fillTriangle = (x1, y1, x2, y2, x3, y3, rgb, alpha) => {
        // Sort points by Y-component
        if (y2 < y1) {
            let tmpX = x1; x1 = x2; x2 = tmpX;
            let tmpY = y1; y1 = y2; y2 = tmpY;
        }
        if (y3 < y1) {
            let tmpX = x1; x1 = x3; x3 = tmpX;
            let tmpY = y1; y1 = y3; y3 = tmpY;
        }
        if (y3 < y2) {
            let tmpX = x2; x2 = x3; x3 = tmpX;
            let tmpY = y2; y2 = y3; y3 = tmpY;
        }

        // Setup for Bresenham-based edge walks (see drawLine implementation).
        var dxShortEdge = x2 - x1;
        var dyShortEdge = y1 - y2;
        var sxShortEdge = 1;
        if (dxShortEdge < 0) {
            dxShortEdge = -dxShortEdge;
            sxShortEdge = -sxShortEdge;
        }
        var eShortEdge = dxShortEdge + dyShortEdge;

        var dxTallEdge = x3 - x1;
        var dyTallEdge = y1 - y3;
        var sxTallEdge = 1;
        if (dxTallEdge < 0) {
            dxTallEdge = -dxTallEdge;
            sxTallEdge = -sxTallEdge;
        }
        var eTallEdge = dxTallEdge + dyTallEdge;

        // Fill scanlines between the short edge between P1 and P2 and the tall
        // edge between P1 and P3, from top to bottom, left to right.
        var xShortEdge = x1;
        var xTallEdge  = x1;
        for (let y = y1; y < y2; ++y) {
            let xStart = xShortEdge;
            let xEnd   = xTallEdge;
            if (xTallEdge < xShortEdge) {
                xStart = xTallEdge;
                xEnd   = xShortEdge;
            }

            while (true) {
                const e2 = eShortEdge<<1;
                if (e2 >= dyShortEdge) {
                    if (xShortEdge < xStart) {
                        xStart = xShortEdge;
                    } else if (xShortEdge > xEnd) {
                        xEnd   = xShortEdge;
                    }
                    xShortEdge += sxShortEdge;
                    eShortEdge += dyShortEdge;
                }
                if (e2 <= dxShortEdge) break;
            }
            while (true) {
                const e2 = eTallEdge<<1;
                if (e2 >= dyTallEdge) {
                    if (xTallEdge < xStart) {
                        xStart = xTallEdge;
                    } else if (xTallEdge > xEnd) {
                        xEnd   = xTallEdge;
                    }
                    xTallEdge += sxTallEdge;
                    eTallEdge += dyTallEdge;
                }
                if (e2 <= dxTallEdge) break;
            }
            eShortEdge += dxShortEdge;
            eTallEdge  += dxTallEdge;

            for (let x = xStart; x <= xEnd; ++x) setPx(x, y, rgb, alpha);
        }

        dxShortEdge = x3 - x2;
        dyShortEdge = y2 - y3;
        sxShortEdge = 1;
        if (dxShortEdge < 0) {
            dxShortEdge = -dxShortEdge;
            sxShortEdge = -sxShortEdge;
        }
        eShortEdge = dxShortEdge + dyShortEdge;

        // Fill scanlines between the short edge between P2 and P3 and the tall
        // edge between P1 and P3, from top to bottom, left to right.
        xShortEdge = x2;
        for (let y = y2; y < y3; ++y) {
            let xStart = xShortEdge;
            let xEnd   = xTallEdge;
            if (xTallEdge < xShortEdge) {
                xStart = xTallEdge;
                xEnd   = xShortEdge;
            }

            while (true) {
                const e2 = eShortEdge<<1;
                if (e2 >= dyShortEdge) {
                    if (xShortEdge < xStart) {
                        xStart = xShortEdge;
                    } else if (xShortEdge > xEnd) {
                        xEnd   = xShortEdge;
                    }
                    xShortEdge += sxShortEdge;
                    eShortEdge += dyShortEdge;
                }
                if (e2 <= dxShortEdge) break;
            }
            while (true) {
                const e2 = eTallEdge<<1;
                if (e2 >= dyTallEdge) {
                    if (xTallEdge < xStart) {
                        xStart = xTallEdge;
                    } else if (xTallEdge > xEnd) {
                        xEnd   = xTallEdge;
                    }
                    xTallEdge += sxTallEdge;
                    eTallEdge += dyTallEdge;
                }
                if (e2 <= dxTallEdge) break;
            }
            eShortEdge += dxShortEdge;
            eTallEdge  += dxTallEdge;

            for (let x = xStart; x <= xEnd; ++x) setPx(x, y, rgb, alpha);
        }

        // Fill the last scanline with y=y3.
        {
            let xStart = xShortEdge;
            let xEnd   = xTallEdge;
            if (xTallEdge < xShortEdge) {
                xStart = xTallEdge;
                xEnd   = xShortEdge;
            }

            while (xShortEdge !== x3) {
                const e2 = eShortEdge<<1;
                if (e2 >= dyShortEdge) {
                    if (xShortEdge < xStart) {
                        xStart = xShortEdge;
                    } else if (xShortEdge > xEnd) {
                        xEnd   = xShortEdge;
                    }
                    xShortEdge += sxShortEdge;
                    eShortEdge += dyShortEdge;
                }
            }
            while (xTallEdge !== x3) {
                const e2 = eTallEdge<<1;
                if (e2 >= dyTallEdge) {
                    if (xTallEdge < xStart) {
                        xStart = xTallEdge;
                    } else if (xTallEdge > xEnd) {
                        xEnd   = xTallEdge;
                    }
                    xTallEdge += sxTallEdge;
                    eTallEdge += dyTallEdge;
                }
            }

            if (x3 < xStart) {
                xStart = x3;
            } else if (x3 > xEnd) {
                xEnd = x3;
            }
            for (let x = xStart; x <= xEnd; ++x) setPx(x, y3, rgb, alpha);
        }
    };

    var inCircle = (x, y, cx, cy, r) => {
        var dx = x - cx;
        var dy = y - cy;
        return dx*dx + dy*dy <= r*r;
    };

    var fillCircle = (cx, cy, r, rgb, alpha) => {
        var xStart = cx - r;
        var yStart = cy - r;
        var xStop  = cx + r + 1;
        var yStop  = cy + r + 1;
        if (xStart < w && yStart < h && xStop > 0 && yStop > 0) {
            if (xStart < 0) xStart = 0;
            if (yStart < 0) yStart = 0;
            if (xStop  > w) xStop  = w;
            if (yStop  > h) yStop  = h;
            for (let y = yStart; y < yStop; ++y) {
                for (let x = xStart; x < xStop; ++x) {
                    if (inCircle(x, y, cx, cy, r)) setPx(x, y, rgb, alpha);
                }
            }
        }
    };

    var UI_HANDLE_NONPIXELATED_RADIUS = 7;
    var uiHandleRadius = Math.ceil(UI_HANDLE_NONPIXELATED_RADIUS / pxSz);
    var mouseX = 0;
    var mouseY = 0;
    var dragging0thPoint = false;
    var LINE_P1 = 1;
    var LINE_P2 = 2;
    var  TRI_P1 = 3;
    var  TRI_P2 = 4;
    var  TRI_P3 = 5;
    var ID = 0;
    var X  = 1;
    var Y  = 2;
    var points = [
        [LINE_P1,0,0], [LINE_P2,0,0],
        [ TRI_P1,0,0], [ TRI_P2,0,0], [TRI_P3,0,0]];

    var resetPoints = () => {
        for (let i = 0; i < points.length; ++i) {
            switch (points[i][ID]) {
                case LINE_P1:
                    points[i][X] = Math.floor(w * 2/5);
                    points[i][Y] = Math.floor(h * 1/5);
                    break;
                case LINE_P2:
                    points[i][X] = Math.floor(w * 1/5);
                    points[i][Y] = Math.floor(h * 4/5);
                    break;
                case TRI_P1:
                    points[i][X] = Math.floor(w * 3/5);
                    points[i][Y] = Math.floor(h * 1/5);
                    break;
                case TRI_P2:
                    points[i][X] = Math.floor(w * 2/5);
                    points[i][Y] = Math.floor(h * 4/5);
                    break;
                case TRI_P3:
                    points[i][X] = Math.floor(w * 4/5);
                    points[i][Y] = Math.floor(h * 3/5);
                    break;
            }
        }
    };
    resetPoints();

    var renderLine = () => {
        var p1Idx = 0;
        var p2Idx = 0;
        for (let i = 0; i < points.length; ++i) {
            switch (points[i][ID]) {
                case LINE_P1: p1Idx = i; break;
                case LINE_P2: p2Idx = i; break;
            }
        }
        var x1 = points[p1Idx][X];
        var y1 = points[p1Idx][Y];
        var x2 = points[p2Idx][X];
        var y2 = points[p2Idx][Y];

        drawLine(x1, y1, x2, y2, GREEN, 160);
        fillCircle(x1, y1, uiHandleRadius, MAGENTA, 127);
        fillCircle(x2, y2, uiHandleRadius, MAGENTA, 127);
    };

    var renderTriangle = () => {
        var p1Idx = 0;
        var p2Idx = 0;
        var p3Idx = 0;
        for (let i = 0; i < points.length; ++i) {
            switch (points[i][ID]) {
                case TRI_P1: p1Idx = i; break;
                case TRI_P2: p2Idx = i; break;
                case TRI_P3: p3Idx = i; break;
            }
        }
        var x1 = points[p1Idx][X];
        var y1 = points[p1Idx][Y];
        var x2 = points[p2Idx][X];
        var y2 = points[p2Idx][Y];
        var x3 = points[p3Idx][X];
        var y3 = points[p3Idx][Y];

        fillTriangle(x1, y1, x2, y2, x3, y3, BLUE, 160);
        fillCircle(x1, y1, uiHandleRadius, YELLOW, 100);
        fillCircle(x2, y2, uiHandleRadius, YELLOW, 100);
        fillCircle(x3, y3, uiHandleRadius, YELLOW, 100);
    };

    var TRIANGLE_THEN_LINE = 1;
    var LINE_THEN_TRIANGLE = 2;

    var render = (order) => {
        if (order === TRIANGLE_THEN_LINE) {
            renderTriangle();
            renderLine();
        } else if (order === LINE_THEN_TRIANGLE) {
            renderLine();
            renderTriangle();
        }
        ctx.putImageData(imageData, 0, 0);
        clearImageData();
    };

    var onMouseMove = (event) => {
        var newMouseX = 0;
        var newMouseY = 0;
        if (event.type === "mousemove") {
            newMouseX = Math.floor(event.pageX / pxSz);
            newMouseY = Math.floor(event.pageY / pxSz);
        } else if (event.type === "touchmove") {
            var touch = event.touches.item(0);
            newMouseX = Math.floor(touch.pageX / pxSz);
            newMouseY = Math.floor(touch.pageY / pxSz);
        }
        if ((newMouseX !== mouseX || newMouseY !== mouseY)
            && document.activeElement !== pxSzSliderEl
            && document.activeElement !== pxSzValueEl
        ) {
            mouseX = newMouseX;
            mouseY = newMouseY;
            if (dragging0thPoint) {
                event.preventDefault();
                points[0][X] = mouseX;
                points[0][Y] = mouseY;
                switch (points[0][ID]) {
                    case LINE_P1: case LINE_P2:
                        render(TRIANGLE_THEN_LINE);
                        break;
                    case TRI_P1: case TRI_P2: case TRI_P3:
                        render(LINE_THEN_TRIANGLE);
                        break;
                }
            }
        }
    };

    var onMouseDown = (event) => {
        var mouseX = 0;
        var mouseY = 0;
        if (event.type === "mousedown") {
            mouseX = Math.floor(event.pageX / pxSz);
            mouseY = Math.floor(event.pageY / pxSz);
        } else if (event.type === "touchstart") {
            var touch = event.touches.item(0);
            mouseX = Math.floor(touch.pageX / pxSz);
            mouseY = Math.floor(touch.pageY / pxSz);
        }
        var selectedPointIdx = -1;
        for (let i = 0; i < points.length && selectedPointIdx == -1; ++i) {
            if (inCircle(mouseX, mouseY, points[i][X], points[i][Y], uiHandleRadius))
                selectedPointIdx = i;
        }
        if (selectedPointIdx !== -1) {
            event.preventDefault();
            if (selectedPointIdx !== 0) {
                // Rotate selected point to start of array
                let id = points[0][ID];
                points[0][ID] = points[selectedPointIdx][ID];
                let x  = points[0][X ];
                points[0][X ] = points[selectedPointIdx][X ];
                let y  = points[0][Y ];
                points[0][Y ] = points[selectedPointIdx][Y ];
                for (let i = 1; i <= selectedPointIdx; ++i) {
                    let temp = points[i][ID];
                    points[i][ID] = id;
                    id = temp;
                    temp = points[i][X];
                    points[i][X] = x;
                    x = temp;
                    temp = points[i][Y];
                    points[i][Y] = y;
                    y = temp;
                }
            }
            dragging0thPoint = true;
        }
    };

    var onMouseUp = (event) => dragging0thPoint = false;

    var onResize = () => {
        if (pxSz === 1) {
            canvasEl.style.imageRendering = null;
        } else {
            // See https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look#crisp_pixel_art_in_canvas
            canvasEl.style.imageRendering = "pixelated";
        }
        w = Math.floor(document.body.clientWidth  / pxSz);
        h = Math.floor(document.body.clientHeight / pxSz);
        canvasEl.width  = w;
        canvasEl.height = h;
        canvasEl.style.width  = `${w * pxSz}px`;
        canvasEl.style.height = `${h * pxSz}px`;
        imageData        = new ImageData(w, h);
        imageDataU32View = new Uint32Array(imageData.data.buffer);
        render(TRIANGLE_THEN_LINE);
    };

    var onInputPxSz = (event) => {
        var strVal  = event.target.value ?? "";
        var newPxSz = Number(strVal);
        if (strVal !== "" && !Number.isNaN(newPxSz) && newPxSz !== pxSz) {
            if (newPxSz < pxSzMin) newPxSz = pxSzMin;
            if (newPxSz > pxSzMax) newPxSz = pxSzMax;
            newPxSz = Math.floor(newPxSz);
            for (let i = 0; i < points.length; ++i) {
                points[i][X] = Math.round(points[i][X] * pxSz / newPxSz);
                points[i][Y] = Math.round(points[i][Y] * pxSz / newPxSz);
            }
            pxSz = newPxSz;
            uiHandleRadius = Math.ceil(UI_HANDLE_NONPIXELATED_RADIUS / pxSz);
            pxSzSliderEl.value = pxSz;
            pxSzValueEl .value = pxSz;
            onResize();
        }
    };

    render(TRIANGLE_THEN_LINE);

    window.addEventListener("mousemove" , onMouseMove);
    window.addEventListener("mousedown" , onMouseDown);
    window.addEventListener("mouseup"   , onMouseUp  );
    window.addEventListener("touchmove" , onMouseMove, {passive: false});
    window.addEventListener("touchstart", onMouseDown, {passive: false});
    window.addEventListener("touchend"  , onMouseUp  );
    window.addEventListener("resize"    , onResize   );
    pxSzSliderEl.addEventListener("input", onInputPxSz);
    pxSzValueEl .addEventListener("input", onInputPxSz);
    resetPointsButtonEl.addEventListener("click", () => {
        resetPoints();
        render(TRIANGLE_THEN_LINE);
    });
};

window.addEventListener("DOMContentLoaded", main);

