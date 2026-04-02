Line & Triangle Rasterizer Demo
===============================

index.js contains code for efficient pixel-by-pixel, software-base
rasterization of lines and triangles using integer addition and subtraction.

The line-rasterization function "drawLine" is based on Alois Zingl's
implementation of Bresenham's algorithm, found on their website
https://zingl.github.io/bresenham.html and described in their paper
"A Rasterizing Algorithm for Drawing Curves"
("Listing 2: Program to plot a line", on page 13).
In my opinion, the paper is very well-written and the algorithms presented very
elegant. I fully recommend you check them out!

The triangle-rasterization function "fillTriangle" adapts the Bresenham's
algorithm implementation to walk along triangle edges ("edge-walking") and fill
the spans of pixels between the left and right edge for each row in the
triangle. This results in a triangle-fill that is performed in top-to-bottom,
left-to-right order. This means that pixels are accessed in strictly increasing
memory-efficient order. Most importantly, pixels in the same row are accessed
consequtively.

The CanvasRenderingContext2D web API
https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D is
used to display the demo.  CanvasRenderingContext2D.putImageData is used to
display pixels from a byte-array of RGBA values; as evident from in-browser
profilers (under the "Performance" tab) this introduces significant per-frame
overhead which could likely be largely reduced by using WebGL to display the
pixel grid as a quad's texture, manipulating the RGB values of the texture.
"setPx" does a multiplication to calculate the offset of the row-start "y*w" in
the RGBA byte-array. This did not prove to be a major bottleneck, but I could
be in other implementations, such as C code compiled to WebAssembly. If so,
the Bresenham's algorithm implementation can be adapted to track the pixel
index instead of X- and Y-coordinates, by adding or subtracting the grid's
pixel-width from the pixel index, every time the Y-coordinate of the pixel
needs to be incremented or decremented
("var sy = dy < 0 ? sy : -sy; ... pxIdx += sy").

My primary goal was to implement and understand a relatively efficient
algorithm for rasterizing triangles, which was achieved. Rendering triangles
is fundamental for 3D and 2D graphics because they are the building blocks
of meshes and polygons.

The code also contains secondary functionality that may be of interest:
alpha-blending in the "setPx" function, simple circle rasterization and
hit-testing with the "fillCircle" and "inCircle" functions, correct
control-point handling using in-place permutation of the point order.

Alois Zingl's work contains implementations and relevant information on
extending Bresenham's-based algorithms to allow for anti-aliasing.  Using this
reference, the code could be extended to support anti-alised line and triangle
rasterization.

The code is MIT-licensed; see LICENSE.txt.

