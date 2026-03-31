"use strict";

var main = () => {
    var isLittleEndian = true;
    {
        const u32Array = new Uint32Array(1);
        u32Array[0] = 0x11223344;
        isLittleEndian = (new Uint8Array(u32Array.buffer))[0] == 0x44;
    }

    var pxSz = 1; // pixel size
    var w = 0;
    var h = 0;

    var canvasEl = document.body.getElementsByTagName("canvas")[0];
    if (pxSz > 1) {
        // See https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look#crisp_pixel_art_in_canvas
        canvasEl.style.imageRendering = "pixelated";
    }
    var ctx = canvasEl.getContext("2d", {alpha: false});
    var imageData        = new ImageData(1, 1);
    var imageDataU8Array = imageData.data;
    var imageDataU32View = new Uint32Array(imageDataU8Array.buffer);

    var clearImageData = () => imageDataU32View.fill(0xFF000000);
    if (!isLittleEndian)
        clearImageData = () => imageDataU32View.fill(255);
    var initImageData = clearImageData;

    var updateScreen = () => {
        ctx.putImageData(imageData, 0, 0);
        clearImageData();
    };

    var update = () => {};

    var onResize = () => {
        w = Math.floor(document.body.clientWidth  / pxSz);
        h = Math.floor(document.body.clientHeight / pxSz);
        canvasEl.style.width  = `${w * pxSz}px`;
        canvasEl.style.height = `${h * pxSz}px`;
        canvasEl.width  = w;
        canvasEl.height = h;
        imageData        = new ImageData(w, h);
        imageDataU8Array = imageData.data;
        imageDataU32View = new Uint32Array(imageDataU8Array.buffer);
        initImageData();
        update();
    };

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

    var testDrawLine     = false;
    var testFillTriangle = true;

    if (testDrawLine) {
        var x1 = 10;
        var y1 = 10;
        var x2 = 50;
        var y2 = 100;
        var mouseX = -1;
        var mouseY = -1;
        var draggingP1 = false;
        var draggingP2 = false;

        update = () => {
            drawLine(x1, y1, x2, y2, 0xFFFFFF, 255);

            setPx(x1, y1, 0xFF00FF, 127);
            setPx(x2, y2, 0xFF00FF, 127);

            updateScreen();
        };
        var onMousemove = (event) => {
            mouseX = Math.floor(event.clientX / pxSz);
            mouseY = Math.floor(event.clientY / pxSz);
            var needsUpdate = false;
            if (draggingP1) {
                needsUpdate = x1 !== mouseX || y1 !== mouseY;
                x1 = mouseX;
                y1 = mouseY;
            } else if (draggingP2) {
                needsUpdate = x2 !== mouseX || y2 !== mouseY;
                x2 = mouseX;
                y2 = mouseY;
            }
            if (needsUpdate) window.requestAnimationFrame(update);
        };
        var onMousedown = (event) => {
            var handleDragDist = Math.ceil(10 / pxSz);
            draggingP1 = Math.abs(mouseX - x1) < handleDragDist
                      && Math.abs(mouseY - y1) < handleDragDist;
            draggingP2 = Math.abs(mouseX - x2) < handleDragDist
                      && Math.abs(mouseY - y2) < handleDragDist;
        };
        var onMouseup = (event) => {
            draggingP1 = false;
            draggingP2 = false;
        };
        window.addEventListener("mousemove", onMousemove);
        window.addEventListener("mousedown", onMousedown);
        window.addEventListener("mouseup"  , onMouseup);
    }
    if (testFillTriangle) {
        var x1 = 50;
        var y1 = 10;
        var x2 = 10;
        var y2 = 100;
        var x3 = 100;
        var y3 = 100;
        var mouseX = -1;
        var mouseY = -1;
        var draggingP1 = false;
        var draggingP2 = false;
        var draggingP3 = false;

        update = () => {
            fillTriangle(x1, y1, x2, y2, x3, y3, 0xFFFFFF, 255);

            drawLine(x1, y1, x2, y2, 0xFF0000, 127);
            drawLine(x2, y2, x3, y3, 0xFF0000, 127);
            drawLine(x3, y3, x1, y1, 0xFF0000, 127);

            setPx(x1, y1, 0x0000FF, 127);
            setPx(x2, y2, 0x0000FF, 127);
            setPx(x3, y3, 0x0000FF, 127);

            updateScreen();
        };
        var onMousemove = (event) => {
            mouseX = Math.floor(event.clientX / pxSz);
            mouseY = Math.floor(event.clientY / pxSz);
            var needsUpdate = false;
            if (draggingP1) {
                needsUpdate ||= x1 !== mouseX || y1 !== mouseY;
                x1 = mouseX;
                y1 = mouseY;
            } else if (draggingP2) {
                needsUpdate ||= x2 !== mouseX || y2 !== mouseY;
                x2 = mouseX;
                y2 = mouseY;
            } else if (draggingP3) {
                needsUpdate ||= x3 !== mouseX || y3 !== mouseY;
                x3 = mouseX;
                y3 = mouseY;
            }
            if (needsUpdate) window.requestAnimationFrame(update);
        };
        var onMousedown = (event) => {
            var handleDragDist = Math.ceil(10 / pxSz);
            draggingP1 = Math.abs(mouseX - x1) < handleDragDist
                      && Math.abs(mouseY - y1) < handleDragDist;
            draggingP2 = Math.abs(mouseX - x2) < handleDragDist
                      && Math.abs(mouseY - y2) < handleDragDist;
            draggingP3 = Math.abs(mouseX - x3) < handleDragDist
                      && Math.abs(mouseY - y3) < handleDragDist;
        };
        var onMouseup = (event) => {
            draggingP1 = false;
            draggingP2 = false;
            draggingP3 = false;
        };
        window.addEventListener("mousemove", onMousemove);
        window.addEventListener("mousedown", onMousedown);
        window.addEventListener("mouseup"  , onMouseup);
    }

    onResize();
    window.addEventListener("resize", onResize);
};

window.addEventListener("DOMContentLoaded", main);

