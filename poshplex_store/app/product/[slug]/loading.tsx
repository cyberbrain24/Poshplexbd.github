import React from "react";

export default function ProductLoading() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 40 }}>
        {/* Left: Image Skeleton */}
        <div style={{ flex: "1 1 500px" }}>
          <div style={{ 
            width: "100%", 
            aspectRatio: "3/4", 
            backgroundColor: "#f0f0f0", 
            animation: "pulse 1.5s infinite ease-in-out" 
          }}></div>
          
          {/* Thumbnails Skeleton */}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ 
                width: "20%", 
                aspectRatio: "3/4", 
                backgroundColor: "#f0f0f0",
                animation: "pulse 1.5s infinite ease-in-out",
                animationDelay: `${i * 0.1}s`
              }}></div>
            ))}
          </div>
        </div>

        {/* Right: Info Skeleton */}
        <div style={{ flex: "1 1 400px", paddingTop: 20 }}>
          {/* Title & Price */}
          <div style={{ width: "80%", height: 32, backgroundColor: "#f0f0f0", marginBottom: 16, animation: "pulse 1.5s infinite" }}></div>
          <div style={{ width: "40%", height: 24, backgroundColor: "#f0f0f0", marginBottom: 32, animation: "pulse 1.5s infinite" }}></div>
          
          {/* Description */}
          <div style={{ width: "100%", height: 16, backgroundColor: "#f0f0f0", marginBottom: 8, animation: "pulse 1.5s infinite" }}></div>
          <div style={{ width: "90%", height: 16, backgroundColor: "#f0f0f0", marginBottom: 8, animation: "pulse 1.5s infinite" }}></div>
          <div style={{ width: "95%", height: 16, backgroundColor: "#f0f0f0", marginBottom: 32, animation: "pulse 1.5s infinite" }}></div>
          
          {/* Variants */}
          <div style={{ width: "120px", height: 16, backgroundColor: "#f0f0f0", marginBottom: 12, animation: "pulse 1.5s infinite" }}></div>
          <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: 60, height: 40, backgroundColor: "#f0f0f0", animation: "pulse 1.5s infinite" }}></div>
            ))}
          </div>

          {/* Button */}
          <div style={{ width: "100%", height: 50, backgroundColor: "#e0e0e0", animation: "pulse 1.5s infinite" }}></div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}} />
    </div>
  );
}
