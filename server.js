// server.js

// 1. Tải các thư viện đã cài đặt
require('dotenv').config(); // Tải biến môi trường từ .env
const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');

// 2. Khởi tạo
const app = express();
const PORT = process.env.PORT || 3001; // Render sẽ tự cung cấp PORT
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 3. Cấu hình Middleware
app.use(cors()); // Cho phép frontend gọi đến
app.use(express.json({ limit: '10mb' })); // Cho phép server nhận dữ liệu JSON lớn (cho file upload)

// 4. Định nghĩa một "API Endpoint" để tạo Gói học tập
app.post('/api/create-study-pack', async (req, res) => {
  try {
    // Lấy dữ liệu (văn bản hoặc file) mà frontend gửi lên
    const { source } = req.body;

    if (!source || (!source.text && !source.file)) {
      return res.status(400).json({ error: 'Vui lòng cung cấp văn bản hoặc một tệp.' });
    }
    
    // --- BẠN CẦN SAO CHÉP 2 THỨ TỪ FRONTEND VÀO ĐÂY ---
    // 1. Sao chép biến `studyPackSchema` từ tệp `services/geminiService.ts` của bạn
    const studyPackSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "Một tiêu đề ngắn gọn, hấp dẫn cho gói học tập dựa trên văn bản." },
        lesson: {
            type: Type.ARRAY,
            description: "Một bài giảng có cấu trúc, toàn diện được tạo ra từ văn bản gốc, được làm giàu bằng các giải thích chuyên sâu. Bài giảng này được chia thành các khối nội dung logic để dễ học.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['heading', 'paragraph', 'tip', 'warning', 'example', 'table'], description: "Loại khối nội dung." },
                    content: { type: Type.STRING, description: "Nội dung văn bản. Đối với bảng, đây là tiêu đề của bảng. Tuân thủ các quy tắc định dạng được chỉ định trong prompt." },
                    tableData: {
                        type: Type.OBJECT,
                        description: "Dữ liệu cho bảng, chỉ sử dụng khi type là 'table'.",
                        properties: {
                            headers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mảng các chuỗi cho tiêu đề cột." },
                            rows: { 
                                type: Type.ARRAY, 
                                description: "Mảng các hàng, trong đó mỗi hàng là một mảng các chuỗi.",
                                items: { 
                                    type: Type.ARRAY, 
                                    items: { type: Type.STRING } 
                                } 
                            }
                        },
                        required: ["headers", "rows"]
                    }
                },
                required: ["type", "content"]
            }
        },
        conciseSummary: {
            type: Type.STRING,
            description: "Một bản tóm tắt cực kỳ cô đọng (3-5 gạch đầu dòng), chỉ tập trung vào các điểm chính về Sinh lý bệnh, Chẩn đoán và Điều trị từ bài giảng. Bản tóm tắt này phải tuân thủ các quy tắc định dạng văn bản đã chỉ định (in đậm, highlight, v.v.) và mỗi mục phải bắt đầu bằng '- '."
        },
        quiz: {
            type: Type.ARRAY,
            description: "Tạo 8-12 câu hỏi trắc nghiệm với độ khó khác nhau, bao gồm cả tình huống lâm sàng, câu hỏi một lựa chọn và nhiều lựa chọn.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Một mảng chứa (các) câu trả lời đúng." },
                    type: { type: Type.STRING, enum: ['single-choice', 'multiple-choice'], description: "Loại câu hỏi trắc nghiệm."},
                    explanation: { type: Type.STRING, description: "Một lời giải thích ngắn gọn cho câu trả lời đúng." },
                    difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] }
                },
                required: ["question", "options", "correctAnswers", "type", "explanation", "difficulty"]
            }
        },
        fillInTheBlanks: {
            type: Type.ARRAY,
            description: "Tạo 5-7 câu hỏi điền vào chỗ trống tập trung vào các thuật ngữ chính. Sử dụng '____' làm chỗ trống.",
            items: {
                type: Type.OBJECT,
                properties: {
                    sentence: { type: Type.STRING },
                    answer: { type: Type.STRING }
                },
                required: ["sentence", "answer"]
            }
        },
        glossary: {
            type: Type.ARRAY,
            description: "Một danh sách các thuật ngữ quan trọng và định nghĩa của chúng từ văn bản.",
            items: {
                type: Type.OBJECT,
                properties: {
                    term: { type: Type.STRING },
                    definition: { type: Type.STRING }
                },
                required: ["term", "definition"]
            }
        }
    },
    required: ["title", "lesson", "conciseSummary", "quiz", "fillInTheBlanks", "glossary"]
};
    
    // 2. Sao chép biến `basePrompt` từ tệp `services/geminiService.ts` của bạn
    const basePrompt = `Bạn là một chuyên gia biên soạn giáo trình y khoa, có nhiệm vụ chuyển đổi tài liệu nguồn phức tạp thành một "Gói học tập" tương tác, hấp dẫn và có cấu trúc tốt cho sinh viên và chuyên gia y tế.

Phân tích kỹ lưỡng nội dung được cung cấp (văn bản hoặc hình ảnh) và tạo ra một gói học tập toàn diện bằng cách tuân thủ nghiêm ngặt schema JSON đã cho.

**YÊU CẦU QUAN TRỌNG:**
1.  **Nội dung chính xác:** Tất cả thông tin phải chính xác về mặt y khoa và phản ánh đúng tài liệu nguồn.
2.  **Cấu trúc rõ ràng:** Sử dụng các loại khối nội dung khác nhau ('heading', 'paragraph', 'tip', 'warning', 'example', 'table') để sắp xếp bài giảng một cách logic và dễ hiểu.
3.  **Câu hỏi chất lượng:** Các câu hỏi trắc nghiệm phải phù hợp, bao quát các điểm chính và có độ khó đa dạng. Lời giải thích phải rõ ràng và mang tính hướng dẫn.
4.  **Định dạng văn bản:** Sử dụng các thẻ định dạng trong chuỗi văn bản để nhấn mạnh thông tin:
    *   \`**Văn bản in đậm**\` cho các thuật ngữ hoặc khái niệm chính.
    *   \`*Văn bản in nghiêng*\` để nhấn mạnh.
    *   \`__Văn bản gạch chân__\` cho các điểm cần lưu ý đặc biệt.
    *   \`==Văn bản được đánh dấu==\` cho các kết quả hoặc dữ liệu quan trọng.
    *   \`[HL]Văn bản nổi bật[/HL]\` cho các thuật ngữ y khoa quan trọng nhất, chúng sẽ được tô màu xanh đặc biệt.
    *   \`[DEF term="Thuật ngữ"]Định nghĩa chi tiết của thuật ngữ đó.[/DEF]\` để tạo định nghĩa khi di chuột qua cho các thuật ngữ phức tạp.
5.  **Tính nhất quán:** Đảm bảo \`correctAnswers\` trong phần trắc nghiệm khớp chính xác với một hoặc nhiều mục trong mảng \`options\`.
6.  **Tóm tắt cốt lõi:** Phần 'conciseSummary' phải được viết bằng markdown, bao gồm tiêu đề, danh sách gạch đầu dòng và **in đậm** để làm nổi bật các điểm chính.
7.  **Phân tích hình ảnh:** Nếu một hình ảnh được cung cấp, hãy phân tích nội dung của nó (văn bản, sơ đồ, biểu đồ) và sử dụng thông tin đó làm nguồn chính để tạo ra gói học tập.`;

    let contents;
    if (source.file) {
      const filePart = { inlineData: { data: source.file.data, mimeType: source.file.mimeType } };
      const textPart = { text: `${basePrompt}${source.text ? `\n\nDưới đây là nội dung cần xử lý. Hướng dẫn bổ sung từ người dùng: "${source.text}"` : '\n\nDưới đây là nội dung cần xử lý.'}` };
      contents = { parts: [filePart, textPart] };
    } else {
      contents = `${basePrompt}\n\nDưới đây là nội dung cần xử lý: "${source.text}"`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: studyPackSchema,
      },
    });

    const jsonString = response.text.trim();
    const generatedPack = JSON.parse(jsonString);

    // Trả kết quả thành công về cho frontend
    res.status(200).json(generatedPack);

  } catch (error) {
    console.error('Lỗi phía server:', error);
    // Trả lỗi về cho frontend
    res.status(500).json({ error: 'Đã xảy ra lỗi khi tạo gói học tập trên máy chủ.' });
  }
});

// Endpoint để hỏi Gia sư AI
app.post('/api/ask-tutor', async (req, res) => {
  try {
    const { context, userQuestion, questionContext } = req.body;
    
    // Logic gọi Gemini API cho gia sư
    const prompt = `Bạn là một Gia sư AI Y khoa. Dựa vào bối cảnh bài học sau đây: "${context}". Và bối cảnh câu hỏi cụ thể (nếu có): "${questionContext || 'Không có'}". Hãy trả lời câu hỏi của học viên một cách rõ ràng, súc tích và chính xác: "${userQuestion}"`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (error) {
    console.error('Lỗi phía server (ask-tutor):', error);
    res.status(500).json({ error: 'Không thể trả lời câu hỏi.' });
  }
});

// Endpoint #3: Tạo thêm câu hỏi trắc nghiệm
app.post('/api/generate-questions', async (req, res) => {
  try {
    const { context, existingQuestions } = req.body;
    
    const singleQuestionSchema = {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
            type: { type: Type.STRING, enum: ['single-choice', 'multiple-choice'] },
            explanation: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] }
        }
    };

    const prompt = `Dựa vào nội dung bài học sau đây: "${context}". Hãy tạo ra 5 câu hỏi trắc nghiệm MỚI và CHẤT LƯỢNG CAO, không trùng lặp với các câu hỏi đã có trong danh sách này: ${JSON.stringify(existingQuestions)}.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: singleQuestionSchema
            }
        }
    });

    const newQuestions = JSON.parse(response.text.trim());
    res.json({ questions: newQuestions });

  } catch (error) {
    console.error('Lỗi phía server (generate-questions):', error);
    res.status(500).json({ error: 'Không thể tạo thêm câu hỏi.' });
  }
});

// 5. Khởi động máy chủ
app.listen(PORT, () => {
  console.log(`Backend đang chạy tại http://localhost:${PORT}`);
});