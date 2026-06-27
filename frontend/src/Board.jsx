import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001'); // Update to Render URL in production
const ROOM_ID = 'design_room_1'; 

const Board = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  
  // UI State
  const [color, setColor] = useState('#2563eb');
  const [brushSize, setBrushSize] = useState(6);
  const [brushType, setBrushType] = useState('solid'); // 'solid', 'dashed', 'highlighter', 'spray'

  useEffect(() => {
    const canvas = canvasRef.current;
    // Make canvas fill most of the screen nicely
    canvas.width = window.innerWidth * 0.85;
    canvas.height = window.innerHeight * 0.75; 
    
    const ctx = canvas.getContext('2d');
    setContext(ctx);

    socket.emit('join_room', ROOM_ID);

    socket.on('load_history', (history) => {
      history.forEach((stroke) => drawLine(ctx, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.brushSize, stroke.brushType, false));
    });

    socket.on('draw_event', (stroke) => {
      drawLine(ctx, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.brushSize, stroke.brushType, false);
    });

    socket.on('clear_board', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => socket.off();
  }, []);

  const drawLine = (ctx, x0, y0, x1, y1, strokeColor, strokeWidth, type, emit) => {
    ctx.beginPath();
    
    // Reset defaults to prevent styles from bleeding into each other
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    // Apply specific brush logic
    if (type === 'dashed') {
      ctx.setLineDash([strokeWidth * 2, strokeWidth * 1.5]);
    } else if (type === 'highlighter') {
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = 'multiply';
      ctx.lineWidth = strokeWidth * 2; // Highlighters are usually thicker
    }

    // Spray can uses random dots instead of continuous lines
    if (type === 'spray') {
      const density = strokeWidth * 2;
      for (let i = 0; i < density; i++) {
        const offsetX = (Math.random() - 0.5) * strokeWidth * 2.5;
        const offsetY = (Math.random() - 0.5) * strokeWidth * 2.5;
        ctx.fillRect(x1 + offsetX, y1 + offsetY, 1, 1);
      }
    } else {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    
    ctx.closePath();

    if (!emit) return;

    // Bundle the new brushType into the payload
    const strokeData = { x0, y0, x1, y1, color: strokeColor, brushSize: strokeWidth, brushType: type, timestamp: Date.now() };
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
    
    drawLine(context, offsetX - 1, offsetY - 1, offsetX, offsetY, color, brushSize, brushType, true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearBoard = () => {
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit('clear_board', ROOM_ID);
  };

  // --- Premium UI Styling Objects ---
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '30px',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)', // Soft pastel gradient
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  };

  const toolbarStyle = {
    display: 'flex',
    gap: '25px',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.8)', // Translucent white
    backdropFilter: 'blur(10px)', // Glassmorphism blur
    padding: '12px 30px',
    borderRadius: '20px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.5)',
  };

  const labelStyle = {
    fontWeight: '600',
    color: '#334155',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const selectStyle = {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    fontWeight: '500',
    cursor: 'pointer',
    outline: 'none'
  };

  const buttonStyle = {
    padding: '10px 20px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
    boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)',
    transition: 'transform 0.1s'
  };

  const canvasWrapperStyle = {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    border: '1px solid #e2e8f0'
  };

  return (
    <div style={containerStyle}>
      
      <div style={toolbarStyle}>
        
        <label style={labelStyle}>
          Brush:
          <select value={brushType} onChange={(e) => setBrushType(e.target.value)} style={selectStyle}>
            <option value="solid">Solid Pen</option>
            <option value="dashed">Dashed Line</option>
            <option value="highlighter">Highlighter</option>
            <option value="spray">Spray Can</option>
          </select>
        </label>

        <label style={labelStyle}>
          Color:
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)} 
            style={{ cursor: 'pointer', border: 'none', background: 'none', height: '32px', width: '32px', padding: 0 }}
          />
        </label>

        <label style={labelStyle}>
          Size: {brushSize}px
          <input 
            type="range" 
            min="1" 
            max="40" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))} 
            style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
          />
        </label>

        <div style={{ width: '2px', height: '30px', background: '#e2e8f0', margin: '0 10px' }}></div> {/* Divider */}

        <button 
          onClick={clearBoard} 
          style={buttonStyle}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Clear Board
        </button>
      </div>

      <div style={canvasWrapperStyle}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          style={{ cursor: 'crosshair', display: 'block' }}
        />
      </div>
      
    </div>
  );
};

export default Board;
