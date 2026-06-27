import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001'); 
const ROOM_ID = 'design_room_1'; 

const Board = () => {
  // --- Game State ---
  const [username, setUsername] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  
  // --- Chat State ---
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);

  // --- Canvas State ---
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const [color, setColor] = useState('#6366f1');
  const [brushSize, setBrushSize] = useState(6);
  const [brushType, setBrushType] = useState('solid'); 

  // --- Socket Listeners (Only run once) ---
  useEffect(() => {
    socket.on('update_players', (playerList) => {
      setPlayers(playerList);
    });

    socket.on('receive_chat', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('load_history', (history) => {
      if (context) {
        history.forEach((stroke) => drawLine(context, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.brushSize, stroke.brushType, false));
      }
    });

    socket.on('draw_event', (stroke) => {
      if (context) {
        drawLine(context, stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.brushSize, stroke.brushType, false);
      }
    });

    socket.on('clear_board', () => {
      if (canvasRef.current && context) {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    });

    return () => {
      socket.off('update_players');
      socket.off('receive_chat');
      socket.off('load_history');
      socket.off('draw_event');
      socket.off('clear_board');
    };
  }, [context]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize Canvas ONLY after joining
  useEffect(() => {
    if (hasJoined && canvasRef.current) {
      const canvas = canvasRef.current;
      // Adjusted size to fit between the sidebars
      canvas.width = window.innerWidth * 0.6;
      canvas.height = window.innerHeight * 0.7; 
      setContext(canvas.getContext('2d'));
    }
  }, [hasJoined]);

  // --- Actions ---
  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      socket.emit('join_game', { roomId: ROOM_ID, username });
      setHasJoined(true);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      const msgData = { sender: username, text: chatMessage, type: 'user' };
      // Show immediately locally
      setMessages((prev) => [...prev, msgData]);
      // Send to server
      socket.emit('send_chat', { roomId: ROOM_ID, username, text: chatMessage });
      setChatMessage('');
    }
  };

  const drawLine = (ctx, x0, y0, x1, y1, strokeColor, strokeWidth, type, emit) => {
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    if (type === 'dashed') {
      ctx.setLineDash([strokeWidth * 2, strokeWidth * 1.5]);
    } else if (type === 'highlighter') {
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = 'multiply';
      ctx.lineWidth = strokeWidth * 2; 
    }

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

  const stopDrawing = () => setIsDrawing(false);
  const clearBoard = () => {
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit('clear_board', ROOM_ID);
  };

  // --- Screens ---
  if (!hasJoined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'radial-gradient(circle at top left, #f3e7e9 0%, #e3eeff 100%)', fontFamily: '"Poppins", sans-serif' }}>
        <form onSubmit={handleJoin} style={{ background: 'rgba(255,255,255,0.8)', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '20px', color: '#1e293b' }}>Join Workspace</h1>
          <input 
            type="text" 
            placeholder="Enter your name" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '12px 20px', fontSize: '16px', borderRadius: '10px', border: '2px solid #cbd5e1', width: '100%', marginBottom: '20px', outline: 'none' }}
            required
          />
          <button type="submit" style={{ width: '100%', padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', fontFamily: '"Poppins", sans-serif', overflow: 'hidden' }}>
      
      {/* Top Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '15px', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', zIndex: 10 }}>
        <select value={brushType} onChange={(e) => setBrushType(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <option value="solid">✏️ Solid Pen</option>
          <option value="dashed">➖ Dashed Line</option>
          <option value="highlighter">🖍️ Highlighter</option>
          <option value="spray">💨 Spray Can</option>
        </select>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ height: '35px', width: '35px', cursor: 'pointer' }} />
        <input type="range" min="1" max="40" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} />
        <button onClick={clearBoard} style={{ padding: '8px 16px', background: '#f43f5e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Clear Canvas</button>
      </div>

      {/* Main 3-Column Workspace */}
      <div style={{ display: 'flex', flex: 1, padding: '20px', gap: '20px', height: 'calc(100vh - 80px)' }}>
        
        {/* Left: Player List */}
        <div style={{ width: '250px', background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 15px 0', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>Concurrent Editors</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {players.map((p, i) => (
              <li key={i} style={{ padding: '10px', background: p === username ? '#e0e7ff' : '#f8fafc', marginBottom: '8px', borderRadius: '8px', fontWeight: p === username ? 'bold' : 'normal' }}>
                👤 {p} {p === username && '(You)'}
              </li>
            ))}
          </ul>
        </div>

        {/* Center: Canvas */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            style={{ cursor: 'crosshair' }}
          />
        </div>

        {/* Right: Real-Time Chat */}
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f8fafc' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: '10px', fontSize: '14px' }}>
                {msg.type === 'system' ? (
                  <span style={{ color: '#10b981', fontStyle: 'italic', fontWeight: 'bold' }}>{msg.text}</span>
                ) : (
                  <span><strong style={{ color: msg.sender === username ? '#6366f1' : '#334155' }}>{msg.sender}:</strong> {msg.text}</span>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChat} style={{ padding: '15px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={chatMessage} 
              onChange={(e) => setChatMessage(e.target.value)} 
              placeholder="Type a message..."
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
            <button type="submit" style={{ padding: '10px 15px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Board;
