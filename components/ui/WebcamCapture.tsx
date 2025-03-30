import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

interface Props {
  onCapture: (base64: string) => void;
}

const WebcamCapture: React.FC<Props> = ({ onCapture }) => {
  const webcamRef = useRef<Webcam>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCaptured(imageSrc);
      onCapture(imageSrc); // Send Base64 image to parent component
    }
  }, [webcamRef, onCapture]);

  return (
    <div>
      <Webcam
        audio={false}
        height={480}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        width={640}
        videoConstraints={videoConstraints}
      />
      <button onClick={capture}>Capture</button>

      {captured && (
        <div>
          <h4>Preview:</h4>
          <img src={captured} alt="Captured" style={{ width: "320px" }} />
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
