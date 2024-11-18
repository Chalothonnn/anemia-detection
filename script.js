let model;
let selectedImage;
let videoStream;

// โหลดโมเดล
async function loadModel() {
  try {
    model = await tf.loadLayersModel('./model/model.json');
    console.log("Model loaded successfully!");
  } catch (error) {
    console.error("Error loading the model:", error);
    alert("ไม่สามารถโหลดโมเดลได้");
  }
}

loadModel();

// จัดการอัพโหลดภาพจากไฟล์
document.getElementById('imageInput').addEventListener('change', handleFileUpload);

// เปิดโหมดกล้อง
async function openCamera() {
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraStream = document.getElementById('cameraStream');
  const uploadLabel = document.getElementById('uploadLabel');
  const imagePreview = document.getElementById('imagePreview');
  
  // ซ่อนปุ่มเลือกรูปภาพและพรีวิว
  uploadLabel.style.display = 'none';
  imagePreview.style.display = 'none';
  document.getElementById('backButton').style.display = 'inline-block'; // แสดงปุ่มย้อนกลับ

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraStream.srcObject = videoStream;
    cameraContainer.style.display = 'block';

    // เพิ่มการสะท้อนภาพในกล้อง (Flip Horizontal)
    cameraStream.style.transform = 'scaleX(-1)';
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("ไม่สามารถเข้าถึงกล้องได้");
  }
}

// ถ่ายภาพ
function captureImage() {
  const cameraStream = document.getElementById('cameraStream');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const previewContainer = document.getElementById('imagePreview');

  // ตั้งค่าขนาดของ canvas ให้ตรงกับวิดีโอ
  canvas.width = cameraStream.videoWidth;
  canvas.height = cameraStream.videoHeight;

  // ทำให้ภาพใน canvas มีลักษณะเหมือนส่องกระจก (สะท้อนภาพ)
  context.save();
  context.scale(-1, 1); // สะท้อนภาพแนวนอน (mirror horizontally)
  context.drawImage(cameraStream, -canvas.width, 0, canvas.width, canvas.height);
  context.restore();

  // เปลี่ยน canvas เป็น data URL และแสดงใน Preview
  const previewImage = new Image();
  previewImage.src = canvas.toDataURL('image/png');
  previewImage.id = "previewImage";
  
  previewContainer.innerHTML = '';
  previewContainer.appendChild(previewImage);
  selectedImage = previewImage;

  // เปิดใช้งานปุ่มวิเคราะห์
  document.getElementById('predictButton').disabled = false;

  // ปิดกล้อง
  stopCamera();
}


// ปิดกล้อง
function stopCamera() {
  const cameraContainer = document.getElementById('cameraContainer');
  const uploadLabel = document.getElementById('uploadLabel');
  const imagePreview = document.getElementById('imagePreview');

  cameraContainer.style.display = 'none';
  uploadLabel.style.display = 'inline-block';
  imagePreview.style.display = 'block';

  // หยุดการสตรีม
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
}

// อัพโหลดไฟล์รูปภาพ
function handleFileUpload(event) {
  const file = event.target.files[0];
  const previewContainer = document.getElementById('imagePreview');
  const previewDefaultText = previewContainer.querySelector('p');

  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      previewDefaultText.style.display = 'none';
      previewContainer.innerHTML = `<img src="${reader.result}" id="previewImage" />`;
      selectedImage = document.getElementById('previewImage');
      document.getElementById('predictButton').disabled = false;
    };
    reader.readAsDataURL(file);
  } else {
    previewDefaultText.style.display = 'block';
    previewContainer.innerHTML = '<p>ยังไม่ได้เลือกรูปภาพ</p>';
    document.getElementById('predictButton').disabled = true;
  }
}

// วิเคราะห์ภาพ
async function analyzeImage() {
  if (!selectedImage) {
    alert('กรุณาเลือกหรือถ่ายภาพก่อน');
    return;
  }

  // แปลงภาพเป็น Tensor
  const tensor = tf.browser.fromPixels(selectedImage)
    .resizeBilinear([224, 224])
    .toFloat()
    .expandDims();

  // ทำนายผลจากโมเดล
  const prediction = await model.predict(tensor).data();
  const predictedClass = prediction.indexOf(Math.max(...prediction)); // หาคลาสที่มีความน่าจะเป็นสูงสุด
  const accuracy = Math.max(...prediction); // ความแม่นยำจากโมเดล
  
  let resultMessage;
  let bloodValue;

  if (predictedClass === 0) {
    // ถ้าเป็นคลาส 0 (มีความเสี่ยงต่อภาวะโลหิตจาง)
    resultMessage = "คุณมีความเสี่ยงต่อการเป็นภาวะโลหิตจาง";
    // คำนวณค่าเลือดในช่วง 12.4 ถึง 9.0 สำหรับคลาส 0 (ความแม่นยำสูงจะทำให้ค่าเลือดต่ำลง)
    bloodValue = (12.4 - (accuracy * (12.4 - 9.0))).toFixed(1); // คำนวณให้ค่าเลือดลดลงตามความแม่นยำ
  } else if (predictedClass === 1) {
    // ถ้าเป็นคลาส 1 (ไม่มีความเสี่ยง)
    resultMessage = "คุณไม่มีความเสี่ยงต่อการเป็นภาวะโลหิตจาง";
    // คำนวณค่าเลือดในช่วง 12.5 ถึง 16.0 สำหรับคลาส 1 (ความแม่นยำสูงจะทำให้ค่าเลือดเพิ่มขึ้น)
    bloodValue = (12.5 + (accuracy * (16.0 - 12.5))).toFixed(1); // คำนวณให้ค่าเลือดเพิ่มขึ้นตามความแม่นยำ
  }

  // แสดงผลลัพธ์
  document.getElementById('result').innerHTML = `<strong>ผลการวิเคราะห์</strong><br>${resultMessage}<br>ค่าเลือดของท่านคือ ${bloodValue} g/dL`;

  // แสดงปุ่มย้อนกลับ
  document.getElementById('backButton').style.display = 'inline-block';
}

// ฟังก์ชันให้ย้อนกลับ
function goBack() {
  // ซ่อนปุ่มย้อนกลับ
  document.getElementById('backButton').style.display = 'none';
  
  // ล้างผลการวิเคราะห์
  document.getElementById('result').innerHTML = '';

  // ซ่อนกล้องและพรีวิวเก่า
  const cameraContainer = document.getElementById('cameraContainer');
  cameraContainer.style.display = 'none';

  // แสดงปุ่มเลือกภาพและพรีวิว
  const uploadLabel = document.getElementById('uploadLabel');
  uploadLabel.style.display = 'inline-block';

  const imagePreview = document.getElementById('imagePreview');
  imagePreview.style.display = 'block';

  // เปิดใช้งานปุ่มวิเคราะห์
  document.getElementById('predictButton').disabled = true;

  // ล้างภาพเก่า
  selectedImage = null;

  // ลบภาพเก่าในพรีวิว
  const previewImage = document.getElementById('previewImage');
  if (previewImage) {
    previewImage.remove();
  }

  // รีเซ็ต input file ให้เป็นค่าเริ่มต้น
  const imageInput = document.getElementById('imageInput');
  imageInput.value = ''; // ล้างไฟล์ที่ถูกเลือกไว้

  // ปิดการสตรีมกล้อง (ถ้าเปิดอยู่)
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null; // รีเซ็ตการเชื่อมต่อกล้อง
  }
}

// ฟังก์ชันจัดการอัพโหลดรูปภาพใหม่
function handleFileUpload(event) {
  const file = event.target.files[0];
  const previewContainer = document.getElementById('imagePreview');
  const previewDefaultText = previewContainer.querySelector('p');

  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      // ซ่อนข้อความ "ยังไม่ได้เลือกรูปภาพ"
      previewDefaultText.style.display = 'none';

      // แสดงภาพใหม่ในพรีวิว
      previewContainer.innerHTML = `<img src="${reader.result}" id="previewImage" />`;
      selectedImage = document.getElementById('previewImage');
      
      // เปิดใช้งานปุ่มวิเคราะห์
      document.getElementById('predictButton').disabled = false;
    };
    reader.readAsDataURL(file);
  } else {
    previewDefaultText.style.display = 'block';
    previewContainer.innerHTML = '<p>ยังไม่ได้เลือกรูปภาพ</p>';
    document.getElementById('predictButton').disabled = true;
  }
}

// เมื่อกดปุ่มวิเคราะห์
async function analyzeImage() {
  if (!selectedImage) {
    alert('กรุณาเลือกหรือถ่ายภาพก่อน');
    return;
  }

  // แปลงภาพเป็น Tensor
  const tensor = tf.browser.fromPixels(selectedImage)
    .resizeBilinear([224, 224])
    .toFloat()
    .expandDims();

  // ทำนายผลจากโมเดล
  const prediction = await model.predict(tensor).data();
  const predictedClass = prediction.indexOf(Math.max(...prediction)); // หาคลาสที่มีความน่าจะเป็นสูงสุด
  const accuracy = Math.max(...prediction); // ความแม่นยำจากโมเดล

  let resultMessage;
  let bloodValue;

  if (predictedClass === 0) {
    // ถ้าเป็นคลาส 0 (มีความเสี่ยงต่อภาวะโลหิตจาง)
    resultMessage = "คุณมีความเสี่ยงต่อการเป็นภาวะโลหิตจาง";
    // คำนวณค่าเลือดในช่วง 12.4 ถึง 9.0 สำหรับคลาส 0
    bloodValue = (12.4 - (accuracy * (12.4 - 9.0))).toFixed(1);
  } else if (predictedClass === 1) {
    // ถ้าเป็นคลาส 1 (ไม่มีความเสี่ยง)
    resultMessage = "คุณไม่มีความเสี่ยงต่อการเป็นภาวะโลหิตจาง";
    // คำนวณค่าเลือดในช่วง 12.5 ถึง 16.0 สำหรับคลาส 1
    bloodValue = (12.5 + (accuracy * (16.0 - 12.5))).toFixed(1);
  }

  // แสดงผลลัพธ์
  document.getElementById('result').innerHTML = `<strong>ผลการวิเคราะห์</strong><br>${resultMessage}<br>ค่าเลือดของท่านคือ ${bloodValue} g/dL`;

  // แสดงปุ่มย้อนกลับหลังการวิเคราะห์เสร็จ
  document.getElementById('backButton').style.display = 'inline-block';
}

// เพิ่ม Event Listeners
document.getElementById('cameraButton').addEventListener('click', openCamera);
document.getElementById('captureButton').addEventListener('click', captureImage);
document.getElementById('predictButton').addEventListener('click', analyzeImage);
document.getElementById('backButton').addEventListener('click', goBack);
document.getElementById('imageInput').addEventListener('change', handleFileUpload);

let currentStream;
let currentCamera = 'user'; // เริ่มต้นที่กล้องหน้า (user)

async function openCamera() {
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraStream = document.getElementById('cameraStream');
  const uploadLabel = document.getElementById('uploadLabel');
  const imagePreview = document.getElementById('imagePreview');

  // ซ่อนปุ่มเลือกรูปภาพและพรีวิว
  uploadLabel.style.display = 'none';
  imagePreview.style.display = 'none';
  document.getElementById('backButton').style.display = 'inline-block'; // แสดงปุ่มย้อนกลับ

  try {
    const constraints = {
      video: {
        facingMode: currentCamera === 'user' ? 'user' : 'environment'
      }
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraStream.srcObject = currentStream;
    cameraContainer.style.display = 'block';

    // เพิ่มการสะท้อนภาพในกล้อง (Flip Horizontal)
    cameraStream.style.transform = 'scaleX(-1)';
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("ไม่สามารถเข้าถึงกล้องได้");
  }
}

// สลับกล้องหน้าและกล้องหลัง
function switchCamera() {
  if (currentStream) {
    // หยุดกล้องก่อน
    currentStream.getTracks().forEach(track => track.stop());
  }

  // สลับค่ากล้อง
  currentCamera = (currentCamera === 'user') ? 'environment' : 'user';

  // เปิดกล้องใหม่
  openCamera();
}

// ถ่ายภาพ
function captureImage() {
  const cameraStream = document.getElementById('cameraStream');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const previewContainer = document.getElementById('imagePreview');

  // ตั้งค่าขนาดของ canvas ให้ตรงกับวิดีโอ
  canvas.width = cameraStream.videoWidth;
  canvas.height = cameraStream.videoHeight;

  // ทำให้ภาพใน canvas มีลักษณะเหมือนส่องกระจก (สะท้อนภาพ)
  context.save();
  context.scale(-1, 1); // สะท้อนภาพแนวนอน (mirror horizontally)
  context.drawImage(cameraStream, -canvas.width, 0, canvas.width, canvas.height);
  context.restore();

  // เปลี่ยน canvas เป็น data URL และแสดงใน Preview
  const previewImage = new Image();
  previewImage.src = canvas.toDataURL('image/png');
  previewImage.id = "previewImage";
  
  previewContainer.innerHTML = '';
  previewContainer.appendChild(previewImage);
  selectedImage = previewImage;

  // เปิดใช้งานปุ่มวิเคราะห์
  document.getElementById('predictButton').disabled = false;

  // ปิดกล้อง
  stopCamera();
}

// ปิดกล้อง
function stopCamera() {
  const cameraContainer = document.getElementById('cameraContainer');
  const uploadLabel = document.getElementById('uploadLabel');
  const imagePreview = document.getElementById('imagePreview');

  cameraContainer.style.display = 'none';
  uploadLabel.style.display = 'inline-block';
  imagePreview.style.display = 'block';

  // หยุดการสตรีม
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
}

// ฟังก์ชันให้ย้อนกลับ
function goBack() {
  // ซ่อนปุ่มย้อนกลับและแสดงตัวเลือกใหม่
  document.getElementById('backButton').style.display = 'none';
  document.getElementById('cameraContainer').style.display = 'none';
  document.getElementById('uploadLabel').style.display = 'inline-block';
  document.getElementById('imagePreview').style.display = 'block';
  document.getElementById('predictButton').disabled = true;
  selectedImage = null;
}

// เพิ่ม Event Listeners
document.getElementById('cameraButton').addEventListener('click', openCamera);
document.getElementById('captureButton').addEventListener('click', captureImage);
document.getElementById('predictButton').addEventListener('click', analyzeImage);
document.getElementById('backButton').addEventListener('click', goBack);
document.getElementById('switchCameraButton').addEventListener('click', switchCamera);  // สลับกล้อง

let currentFacingMode = "user"; // เริ่มต้นที่กล้องหน้า

// โหลดโมเดล
async function loadModel() {
  try {
    model = await tf.loadLayersModel('./model/model.json');
    console.log("Model loaded successfully!");
  } catch (error) {
    console.error("Error loading the model:", error);
    alert("ไม่สามารถโหลดโมเดลได้");
  }
}

loadModel();

// จัดการเปิดกล้อง
async function openCamera() {
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraStream = document.getElementById('cameraStream');
  const uploadLabel = document.getElementById('uploadLabel');
  const imagePreview = document.getElementById('imagePreview');
  const switchCameraButton = document.getElementById('switchCameraButton');

  // ซ่อนปุ่มเลือกภาพและพรีวิว
  uploadLabel.style.display = 'none';
  imagePreview.style.display = 'none';
  switchCameraButton.style.display = 'inline-block';
  document.getElementById('backButton').style.display = 'inline-block';

  // เปิดกล้อง
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
    });
    cameraStream.srcObject = videoStream;
    cameraContainer.style.display = 'block';
    cameraStream.style.transform = currentFacingMode === "user" ? "scaleX(-1)" : "scaleX(1)"; // สะท้อนกล้องหน้า
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("ไม่สามารถเข้าถึงกล้องได้");
  }
}

// สลับกล้อง
async function switchCamera() {
  // เปลี่ยนกล้องจากหน้าไปหลัง หรือหลังไปหน้า
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";

  // หยุดกล้องเดิม
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
  }

  // เปิดกล้องใหม่ด้วยโหมดใหม่
  await openCamera();
}

// ถ่ายภาพ
function captureImage() {
  const cameraStream = document.getElementById('cameraStream');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const previewContainer = document.getElementById('imagePreview');

  // ตั้งค่าขนาดของ canvas
  canvas.width = cameraStream.videoWidth;
  canvas.height = cameraStream.videoHeight;

  // วาดภาพจากกล้อง
  context.translate(
    currentFacingMode === "user" ? canvas.width : 0,
    0
  ); // สะท้อนภาพถ้าเป็นกล้องหน้า
  context.scale(
    currentFacingMode === "user" ? -1 : 1,
    1
  );
  context.drawImage(cameraStream, 0, 0, canvas.width, canvas.height);

  // แปลงเป็น Data URL
  const previewImage = new Image();
  previewImage.src = canvas.toDataURL('image/png');
  previewImage.id = "previewImage";

  previewContainer.innerHTML = '';
  previewContainer.appendChild(previewImage);
  selectedImage = previewImage;

  // เปิดใช้งานปุ่มวิเคราะห์
  document.getElementById('predictButton').disabled = false;

  // ปิดกล้อง
  stopCamera();
}

// ปิดกล้อง
function stopCamera() {
  const cameraContainer = document.getElementById('cameraContainer');
  const uploadLabel = document.getElementById('uploadLabel');
  const imagePreview = document.getElementById('imagePreview');

  cameraContainer.style.display = 'none';
  uploadLabel.style.display = 'inline-block';
  imagePreview.style.display = 'block';

  // หยุดสตรีม
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
  }
}

// อัพโหลดภาพ
function handleFileUpload(event) {
  const file = event.target.files[0];
  const previewContainer = document.getElementById('imagePreview');
  const previewDefaultText = previewContainer.querySelector('p');

  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      previewDefaultText.style.display = 'none';
      previewContainer.innerHTML = `<img src="${reader.result}" id="previewImage" />`;
      selectedImage = document.getElementById('previewImage');
      document.getElementById('predictButton').disabled = false;
    };
    reader.readAsDataURL(file);
  } else {
    previewDefaultText.style.display = 'block';
    previewContainer.innerHTML = '<p>ยังไม่ได้เลือกรูปภาพ</p>';
    document.getElementById('predictButton').disabled = true;
  }
}

// ฟังก์ชันย้อนกลับ
function goBack() {
  document.getElementById('backButton').style.display = 'none';
  document.getElementById('switchCameraButton').style.display = 'none';
  stopCamera();
  document.getElementById('imagePreview').innerHTML = '<p>ยังไม่ได้เลือกรูปภาพ</p>';
  selectedImage = null;
  document.getElementById('predictButton').disabled = true;
}

// เพิ่ม Event Listeners
document.getElementById('cameraButton').addEventListener('click', openCamera);
document.getElementById('switchCameraButton').addEventListener('click', switchCamera);
document.getElementById('captureButton').addEventListener('click', captureImage);
document.getElementById('imageInput').addEventListener('change', handleFileUpload);
document.getElementById('backButton').addEventListener('click', goBack);

let usingFrontCamera = true; // เริ่มต้นด้วยกล้องหน้า

// เปิดกล้อง
async function openCamera() {
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraStream = document.getElementById('cameraStream');
  const switchCameraButton = document.getElementById('switchCameraButton');
  
  // แสดงปุ่มสำหรับสลับกล้อง
  switchCameraButton.style.display = 'inline-block';
  document.getElementById('backButton').style.display = 'inline-block';

  try {
    // เปิดกล้อง
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: usingFrontCamera ? 'user' : 'environment'
      }
    });
    cameraStream.srcObject = videoStream;
    cameraContainer.style.display = 'block';
    document.getElementById('uploadLabel').style.display = 'none';
    document.getElementById('imagePreview').style.display = 'none';
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("ไม่สามารถเข้าถึงกล้องได้");
  }
}

// สลับกล้อง
async function switchCamera() {
  usingFrontCamera = !usingFrontCamera; // เปลี่ยนสถานะกล้อง

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop()); // ปิดการใช้งานกล้องปัจจุบัน
  }
  await openCamera(); // เปิดกล้องใหม่
}

// ปิดกล้อง
function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('cameraContainer').style.display = 'none';
  document.getElementById('uploadLabel').style.display = 'inline-block';
  document.getElementById('imagePreview').style.display = 'block';
  document.getElementById('switchCameraButton').style.display = 'none';
}

// จัดการปุ่ม
document.getElementById('cameraButton').addEventListener('click', openCamera);
document.getElementById('switchCameraButton').addEventListener('click', switchCamera);
document.getElementById('captureButton').addEventListener('click', captureImage);
document.getElementById('backButton').addEventListener('click', stopCamera);

// ฟังก์ชันเปิดกล้อง
async function openCamera() {
  const cameraContainer = document.getElementById('cameraContainer');
  const cameraStream = document.getElementById('cameraStream');
  const switchCameraButton = document.getElementById('switchCameraButton');
  const backButton = document.getElementById('backButton');

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: usingFrontCamera ? 'user' : 'environment'
      }
    });

    cameraStream.srcObject = videoStream;

    // แสดงส่วนกล้องและปุ่มที่เกี่ยวข้อง
    cameraContainer.style.display = 'block';
    switchCameraButton.style.display = 'inline-block';
    backButton.style.display = 'inline-block';
    document.getElementById('uploadLabel').style.display = 'none';
    document.getElementById('imagePreview').style.display = 'none';
  } catch (error) {
    console.error("Error accessing camera:", error);
    alert("ไม่สามารถเข้าถึงกล้องได้");
  }
}

// ฟังก์ชันสลับกล้อง
async function switchCamera() {
  usingFrontCamera = !usingFrontCamera; // สลับสถานะกล้องหน้า/หลัง

  // ปิดการสตรีมก่อนหน้า
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }

  await openCamera(); // เปิดกล้องใหม่ตามสถานะ
}

// ฟังก์ชันหยุดกล้อง
function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('cameraContainer').style.display = 'none';
  document.getElementById('switchCameraButton').style.display = 'none';
  document.getElementById('backButton').style.display = 'none';
  document.getElementById('uploadLabel').style.display = 'inline-block';
  document.getElementById('imagePreview').style.display = 'block';
}

// ฟังก์ชันถ่ายภาพ
function captureImage() {
  const cameraStream = document.getElementById('cameraStream');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const previewContainer = document.getElementById('imagePreview');

  canvas.width = cameraStream.videoWidth;
  canvas.height = cameraStream.videoHeight;

  // วาดภาพใน canvas
  context.translate(canvas.width, 0);
  context.scale(-1, 1); // พลิกภาพเหมือนกระจก
  context.drawImage(cameraStream, 0, 0, canvas.width, canvas.height);

  const previewImage = new Image();
  previewImage.src = canvas.toDataURL('image/png');
  previewImage.id = "previewImage";

  previewContainer.innerHTML = '';
  previewContainer.appendChild(previewImage);

  document.getElementById('predictButton').disabled = false;
  stopCamera(); // ปิดกล้องหลังถ่ายภาพ
}

// เพิ่ม Event Listeners
document.getElementById('cameraButton').addEventListener('click', openCamera);
document.getElementById('switchCameraButton').addEventListener('click', switchCamera);
document.getElementById('captureButton').addEventListener('click', captureImage);
document.getElementById('backButton').addEventListener('click', stopCamera);
