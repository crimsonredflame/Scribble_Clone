import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001'); // Remember to update this to Render URL when deploying
const ROOM_ID = 'design_room_1'; 

const Board = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  
  // New UI State
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 0.8;
    canvas.height = window.innerHeight * 0.7; // Slightly smaller to fit the new toolbar
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round'; // Makes sharp corners smooth
    setContext(ctx);

    socket.emit('join_room', ROOM_ID);

    socket.on('load_history', (history) => {
      // Now extracting color and brushSize from the history objects
      history.forEach((stroke) => drawLine(ctx, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.brushSize, false));
    });

    socket.on('draw_event', (stroke) => {
      drawLine(ctx, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.brushSize, false);
    });

    socket.on('clear_board', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => socket.off();
  }, []);

  // Effect to update the canvas context immediately when the user changes a setting
  useEffect(() => {
    if (context) {
      context.strokeStyle = color;
      context.lineWidth = brushSize;
    }
  }, [color, brushSize, context]);

  // drawLine now accepts strokeColor and strokeWidth as parameters
  const drawLine = (ctx, x0, y0, x1, y1, strokeColor, strokeWidth, emit) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;

    // Bundle the current UI settings into the payload
    const strokeData = { x0, y0, x1, y1, color: strokeColor, brushSize: strokeWidth, timestamp: Date.now() };
    socket.emit('draw_event', { roomId: ROOM_ID, strokeData });
  };

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    
    // Pass the state variables into the draw function
    drawLine(context, offsetX - 1, offsetY - 1, offsetX, offsetY, color, brushSize, true);
  };

  const stopDrawing = () => {
    context.closePath();
    setIsDrawing(false);
  };

  const clearBoard = () => {
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit('clear_board', ROOM_ID);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
      
      {/* New Toolbar UI */}
      <div style={{ display: 'flex', gap: '30px', alignItems: 'center', background: '#f4f4f5', padding: '15px 25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="colorPicker" style={{ fontWeight: 'bold' }}>Color:</label>
          <input 
            type="color" 
            id="colorPicker" 
            value={color} 
            onChange={(e) => setColor(e.target.value)} 
            style={{ cursor: 'pointer', border: 'none', background: 'none', height: '30px', width: '30px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="brushSize" style={{ fontWeight: 'bold' }}>Size: {brushSize}px</label>
          <input 
            type="range" 
            id="brushSize" 
            min="1" 
            max="50" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))} 
            style={{ cursor: 'pointer' }}
          />
        </div>

        <button 
          onClick={clearBoard} 
          style={{ padding: '8px 16px', cursor: 'pointer', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
        >
          Clear Board
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        style={{ border: '2px solid #e5e7eb', borderRadius: '8px', cursor: 'crosshair', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
      />
    </div>
  );
};

export default Board;
