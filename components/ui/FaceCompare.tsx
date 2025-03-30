
import React, { useState } from "react";
import WebcamCapture from "./WebcamCapture";

const FaceCompareComponent: React.FC = () => {
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const databaseUrls = [
    "https://...jpg",
    "https://...jpg"
  ];

  const handleSubmit = async () => {
    if (!base64Image) return alert("Please capture a photo first!");

    const payload = {
      capturedImage: base64Image,
      databaseUrls: databaseUrls,
    };

    try {
      const response = await fetch("https://facial-recognition-api-4gg7.onrender.com/api/compare-faces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    }
  };

  return (
    <div>
      <h2>Facial Recognition</h2>
      <WebcamCapture onCapture={setBase64Image} />
      <button onClick={handleSubmit}>Submit to API</button>

      {result && (
        <div>
          <h4>API Result:</h4>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default FaceCompareComponent;






