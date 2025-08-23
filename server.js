// server.js

// 1. Tải các thư viện đã cài đặt
require('dotenv').config(); // Tải biến môi trường từ .env
const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');

// 2. Khởi tạo
const app = express();
const PORT = process.env.PORT || 3001;
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 3. Cấu hình Middleware
const corsOptions = {
  origin: 'https://ai-ho-tro-y-khoa-by-qmin.onrender.com', // URL chính xác của frontend của bạn
  optionsSuccessStatus: 200 
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Cho phép server nhận dữ liệu JSON lớn

// --- API Endpoint #1: Tạo Gói học tập ---
app.post('/api/create-study-pack', async (req, res) => {
  try {
    const { source } = req.body;
    if (!source || (!source.text && !source.file)) {
      return res.status(400).json({ error: 'Vui lòng cung cấp văn bản hoặc một tệp.' });
    }
    
    // Schema và Prompt được sao chép và cập nhật từ `services/geminiService.ts` của frontend
    // Đảm bảo logic giống hệt nhau
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
                                rows: { type: Type.ARRAY, description: "Mảng các hàng, trong đó mỗi hàng là một mảng các chuỗi.", items: { type: Type.ARRAY, items: { type: Type.STRING } } }
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
            m2StaatexamQuiz: {
                type: Type.ARRAY,
                description: "Tạo 5-12 câu hỏi trắc nghiệm theo phong cách M2 Staatsexamen. Mỗi câu hỏi phải là dạng single-choice với 5 lựa chọn, bắt đầu bằng một ca lâm sàng chi tiết, và kiểm tra khả năng áp dụng kiến thức lâm sàng.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Một mảng chứa chính xác 5 phương án trả lời." },
                        correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Một mảng chứa DUY NHẤT một câu trả lời đúng." },
                        type: { type: Type.STRING, enum: ['single-choice'], description: "Loại câu hỏi BẮT BUỘC phải là 'single-choice'."},
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
        required: ["title", "lesson", "conciseSummary", "quiz", "m2StaatexamQuiz", "fillInTheBlanks", "glossary"]
    };

    const basePrompt = `Bạn là một chuyên gia biên soạn giáo trình y khoa, chuyên tạo ra các câu hỏi ôn tập chất lượng cao theo phong cách M2 Staatsexamen. Nhiệm vụ của bạn là chuyển đổi tài liệu y khoa do người dùng cung cấp thành một Gói học tập toàn diện bằng tiếng Việt, tập trung vào kiến thức "high-yield" và khả năng áp dụng lâm sàng. Hãy tuân thủ nghiêm ngặt các quy tắc sau:

1.  **Phân Tích & Tổng Hợp Bài Giảng:**
    *   Xác định chủ đề chính và các khái niệm cốt lõi.
    *   Tái cấu trúc thông tin thành một bài giảng có logic, dễ hiểu. Sử dụng tiêu đề, đoạn văn, bảng biểu, mẹo, cảnh báo và ví dụ.
    *   **Tạo Bảng Tự Động:** Nếu nội dung mô tả sự so sánh (ví dụ: so sánh hai hội chứng) hoặc một hệ thống phân loại phức tạp, BẮT BUỘC phải chuyển nó thành dạng bảng (\`type: 'table'\`) để dễ so sánh.
    *   **QUY TẮC BẢNG (CỰC KỲ QUAN TRỌNG):** Khi tạo một khối \`type: 'table'\`, bạn **BẮT BUỘC** phải điền dữ liệu (tiêu đề cột và các hàng) vào đối tượng \`tableData\`. Trường \`content\` chỉ được phép chứa **tiêu đề chính** của bảng. **TUYỆT ĐỐI KHÔNG** được đặt bảng định dạng Markdown vào trong trường \`content\`.
    *   **Định Dạng Nội Dung Văn Bản:** Sử dụng các thẻ sau để định dạng văn bản trong TẤT CẢ các loại nội dung (đoạn văn, mẹo, cảnh báo, ô bảng, v.v.):
        *   **In đậm:** \`**văn bản**\`. Dùng cho các thuật ngữ rất quan trọng hoặc các tiêu đề phụ trong một khối văn bản.
        *   **In nghiêng:** \`*văn bản*\`. Dùng để nhấn mạnh hoặc cho các thuật ngữ tiếng nước ngoài.
        *   **Gạch chân:** \`__văn bản__\`. Sử dụng một cách tiết kiệm cho sự nhấn mạnh đặc biệt.
        *   **Highlight:** \`==văn bản==\`. Dùng để làm nổi bật thông tin "high-yield", các giá trị quan trọng, hoặc các điểm cần ghi nhớ.
        *   **Thuật ngữ y khoa (Màu xanh):** \`[HL]văn bản[/HL]\`. Dành riêng cho các thuật ngữ y khoa chính.
        *   **Giải thích thuật ngữ (Tooltip):** \`[DEF term="Thuật ngữ"]Nội dung giải thích.[/DEF]\`.
    *   **Định Dạng Cấu Trúc:**
        *   **Tiêu đề (heading):** LUÔN LUÔN bắt đầu bằng một biểu tượng cảm xúc (emoji) phù hợp và một dấu cách (ví dụ: "🩺 Chẩn đoán", "🔬 Xét nghiệm").
        *   **Tiêu đề chính (IN HOA):** Các tiêu đề chính trong y khoa như ĐỊNH NGHĨA, DỊCH TỄ HỌC, NGUYÊN NHÂN, SINH LÝ BỆNH, TRIỆU CHỨNG LÂM SÀNG, CHẨN ĐOÁN, ĐIỀU TRỊ, và PHÒNG NGỪA BẮT BUỘC phải được viết IN HOA toàn bộ (ví dụ: "🔬 CHẨN ĐOÁN", "💊 ĐIỀU TRỊ").
        *   **QUY TẮC NỘI DUNG CÓ GIÁ TRỊ (CỰC KỲ QUAN TRỌNG):** Nội dung của các khối \`tip\`, \`warning\`, và \`example\` BẮT BUỘC phải là một lời khuyên, cảnh báo hoặc ví dụ thực sự hữu ích. TUYỆT ĐỐI KHÔNG được điền nội dung giữ chỗ hoặc chỉ điền tên của chính loại khối đó (ví dụ: không được tạo khối \`{"type": "tip", "content": "tip"}\`).
        *   **QUY TẮC GOM NHÓM NỘI DUNG (CỰC KỲ QUAN TRỌNG):** Khi tạo một khối \`tip\`, \`warning\`, hoặc \`example\`, bạn BẮT BUỘC phải gộp TOÀN BỘ nội dung liên quan (bao gồm tiêu đề, đoạn văn, và danh sách) vào trong MỘT trường \`content\` duy nhất. TUYỆT ĐỐI không được tách một tiêu đề và danh sách đi kèm của nó thành hai khối riêng biệt.
        *   Đối với các loại \`tip\`, \`warning\`, và \`example\`, **KHÔNG** bao gồm biểu tượng cảm xúc (ví dụ: 💡, ⚠️) trong trường \`content\`. Giao diện người dùng sẽ tự động thêm chúng.
        *   **Danh sách (Lists):** Đối với các danh sách, LUÔN LUÔN bắt đầu mỗi mục bằng một dấu gạch ngang và một dấu cách (ví dụ: \`- Mục 1\`).
        *   **QUY TẮC DANH SÁCH (CỰC KỲ QUAN TRỌNG):** Khi tạo một danh sách, mỗi mục BẮT BUỘC phải bắt đầu trên một dòng mới. TUYỆT ĐỐI KHÔNG được gộp nhiều mục danh sách vào cùng một dòng.
        *   **Định dạng Từ Viết Tắt Ghi Nhớ (Mnemonics - CỰC KỲ QUAN TRỌNG):** Khi giải thích một từ viết tắt ghi nhớ (ví dụ: PIRATES, MONA), BẮT BUỘC phải định dạng nó dưới dạng danh sách, với mỗi chữ cái và phần giải thích tương ứng nằm trên một dòng riêng. Ví dụ đúng:
            \`\`\`
            - P – Bệnh lý phổi
            - I – Thiếu máu cục bộ (Ischemia)
            - R – Bệnh tim do thấp khớp (Rheumatic heart disease)
            \`\`\`
            TUYỆT ĐỐI không viết: \`P – Bệnh lý phổi, I – Thiếu máu cục bộ, R – Bệnh tim...\`

2.  **Tạo Tóm tắt Cô đọng (QUAN TRỌNG):**
    *   Từ bài giảng đã tạo, hãy viết một bản tóm tắt **cực kỳ cô đọng** dưới dạng danh sách gạch đầu dòng (15-20 gạch đầu dòng).
    *   Mỗi gạch đầu dòng nên chắt lọc một khía cạnh lâm sàng quan trọng: **Sinh lý bệnh**, **Chẩn đoán**, hoặc **Điều trị**.
    *   Sử dụng các thẻ định dạng (ví dụ: \`**văn bản**\`, \`==văn bản==\`, \`[HL]văn bản[/HL]\`) để làm nổi bật các từ khóa chính trong tóm tắt.
    *   BẮT ĐẦU mỗi mục trong danh sách bằng một dấu gạch ngang và một dấu cách (ví dụ: \`- Mục 1\`).

3.  **Tạo Câu Hỏi Trắc Nghiệm (Quiz) Đa Dạng:**
    *   **Số lượng:** Tạo ra 8-12 câu hỏi trắc nghiệm.
    *   **Đa dạng hóa:** Tạo một sự kết hợp đa dạng các loại câu hỏi:
        *   **Câu hỏi dựa trên ca lâm sàng (Vignette):** Bắt đầu câu hỏi bằng một kịch bản lâm sàng ngắn gọn (2-4 câu) mô tả bệnh nhân, triệu chứng và các phát hiện ban đầu, sau đó đặt một câu hỏi liên quan đến chẩn đoán, xét nghiệm tiếp theo hoặc điều trị.
        *   **Câu hỏi chọn một đáp án đúng (\`type: 'single-choice'\`):** Câu hỏi trắc nghiệm tiêu chuẩn.
        *   **Câu hỏi chọn nhiều đáp án đúng (\`type: 'multiple-choice'\`):** Đặt câu hỏi yêu cầu "chọn tất cả các đáp án phù hợp" hoặc "chọn X đáp án đúng".
    *   **QUAN TRỌNG (Đáp án đúng):** Đối với MỌI câu hỏi, bạn BẮT BUỘC phải cung cấp (các) câu trả lời đúng trong mảng \`correctAnswers\`. Văn bản của (các) câu trả lời này phải **KHỚP CHÍNH XÁC** với văn bản của tùy chọn tương ứng.
    *   **Chất lượng:** Các lựa chọn sai (distractors) phải hợp lý và phổ biến để thực sự kiểm tra sự hiểu biết.
    *   **Giải thích:** Cung cấp một lời giải thích rõ ràng và súc tích cho câu trả lời đúng.

4.  **Tạo Câu Hỏi Trắc Nghiệm Phong Cách M2 Staatsexamen (QUAN TRỌNG):**
    *   **Vai trò:** Bạn là chuyên gia tạo câu hỏi thi theo tiêu chuẩn của IMPP cho kỳ thi M2 Staatsexamen.
    *   **Số lượng:** Tạo ra 5-12 câu hỏi.
    *   **Cấu trúc BẮT BUỘC:**
        *   Tất cả các câu hỏi phải là dạng **Single-Choice**.
        *   Mỗi câu hỏi phải có **chính xác 5 phương án trả lời**.
        *   Chỉ có **duy nhất MỘT đáp án đúng**.
    *   **Nội dung câu hỏi (Ưu tiên Case-based):**
        *   Mỗi câu hỏi BẮT BUỘC phải bắt đầu bằng một ca bệnh (case vignette) chi tiết (3-5 câu trở lên), mô tả bệnh nhân (tuổi, giới tính), triệu chứng, tiền sử, kết quả khám và xét nghiệm.
        *   Sau ca bệnh là một câu hỏi rõ ràng về: chẩn đoán có khả năng nhất, phương pháp điều trị ưu tiên, cơ chế bệnh sinh, hoặc bước xử trí tiếp theo.
    *   **Nguyên tắc tạo đáp án nhiễu (Distractors):**
        *   Bốn phương án sai phải hợp lý và có tính thử thách, không được quá vô lý.
        *   Các phương án nhiễu nên là các chẩn đoán phân biệt quan trọng, các phương pháp điều trị đúng nhưng không phải là lựa chọn ưu tiên hàng đầu, hoặc các khái niệm liên quan nhưng không chính xác trong bối cảnh ca bệnh.
    *   **Nguyên tắc nội dung:** Tập trung vào các bệnh lý phổ biến trong thực hành lâm sàng, các tình huống cấp cứu, và các quyết định lâm sàng quan trọng.
    *   **Tuân thủ quy tắc JSON:** Bạn BẮT BUỘC phải cung cấp (các) câu trả lời đúng trong mảng \`correctAnswers\` (chỉ chứa một chuỗi) KHỚP CHÍNH XÁC với văn bản của tùy chọn, và cung cấp lời giải thích rõ ràng, dựa trên y học chứng cứ.

5.  **Tạo Các Hoạt Động Học Tập Khác:**
    *   **Điền vào chỗ trống:** Tạo 5-7 câu hỏi điền vào chỗ trống tập trung vào các thuật ngữ, giá trị hoặc khái niệm quan trọng.
    *   **Thuật ngữ:** Xây dựng một danh sách các thuật ngữ quan trọng và định nghĩa của chúng.

6.  **Nguồn chính:** Luôn coi nội dung của người dùng là nguồn thông tin cốt lõi. Không thay đổi ý nghĩa hoặc thông tin cơ bản. Bạn chỉ làm giàu và tái cấu trúc nó.`;

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

    res.status(200).json(generatedPack);

  } catch (error) {
    console.error('Lỗi phía server (create-study-pack):', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi tạo gói học tập trên máy chủ.' });
  }
});

// --- API Endpoint #2: Hỏi Gia sư AI ---
app.post('/api/ask-tutor', async (req, res) => {
  try {
    const { context, userQuestion, questionContext } = req.body;
    
    let prompt = `Bạn là một Gia sư Y khoa AI. Nhiệm vụ của bạn là trả lời câu hỏi của người dùng một cách rõ ràng, ngắn gọn và hữu ích, dựa trên bối cảnh được cung cấp.
    **QUAN TRỌNG**: Hãy sử dụng Markdown để định dạng câu trả lời của bạn. Cụ thể:
    - Sử dụng \`# \`, \`## \`, và \`### \` cho các cấp độ tiêu đề khác nhau để cấu trúc câu trả lời của bạn.
    - Sử dụng \`**text**\` để **in đậm** các thuật ngữ y khoa hoặc các điểm chính.
    - Sử dụng \`*text*\` để *in nghiêng* khi cần nhấn mạnh.
    - Sử dụng \`__text__\` để __gạch chân__ các phần quan trọng.
    - Sử dụng \`==text==\` để ==làm nổi bật== thông tin cần nhớ.
    - Sử dụng danh sách gạch đầu dòng (-) hoặc có số (1.) để liệt kê thông tin.
    - Để trình bày dữ liệu dạng bảng (ví dụ: so sánh các loại thuốc), hãy sử dụng cú pháp bảng Markdown tiêu chuẩn (sử dụng dấu gạch đứng | và dấu gạch ngang -).`;

    if (questionContext) {
        prompt += `\n\n**ƯU TIÊN HÀNG ĐẦU:** Người dùng đang xem xét câu hỏi trắc nghiệm sau đây và đã yêu cầu giải thích thêm. Hãy tập trung câu trả lời của bạn vào việc làm rõ các khái niệm liên quan trực tiếp đến câu hỏi và lời giải thích của nó. Hãy sử dụng bối cảnh bài học tổng quát để bổ sung cho lời giải thích của bạn nếu cần thiết.
        ---
        **Câu hỏi trắc nghiệm đang xem:**
        ${questionContext}
        ---`;
    }

    prompt += `\n\n**Bối cảnh bài học tổng quát:**\n"${context}"`;
    prompt += `\n\n**Câu hỏi của người dùng:**\n"${userQuestion}"`;

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

// --- API Endpoint #3: Tạo thêm câu hỏi trắc nghiệm ---
app.post('/api/generate-questions', async (req, res) => {
  try {
    const { context, existingQuestions, isM2Style } = req.body;
    
    const quizItemSchema = {
      type: Type.OBJECT,
      properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
          type: { type: Type.STRING, enum: ['single-choice', 'multiple-choice'] },
          explanation: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] }
      },
      required: ["question", "options", "correctAnswers", "type", "explanation", "difficulty"]
    };

    const newQuestionsSchema = {
      type: Type.OBJECT,
      properties: {
          new_questions: {
              type: Type.ARRAY,
              description: "Một mảng gồm 5 câu hỏi trắc nghiệm hoàn toàn mới.",
              items: quizItemSchema
          }
      },
      required: ["new_questions"]
    };

    const existingQuestionsString = existingQuestions.map((q) => q.question).join('\n - ');
    const m2Instruction = isM2Style
        ? "Mỗi câu hỏi BẮT BUỘC phải bắt đầu bằng một ca lâm sàng chi tiết (vignette) theo phong cách M2 Staatsexamen. Tất cả câu hỏi phải là 'single-choice' với 5 phương án trả lời."
        : "Bao gồm cả câu hỏi một lựa chọn ('single-choice') và nhiều lựa chọn ('multiple-choice').";
            
    const prompt = `Bạn là một chuyên gia biên soạn giáo trình y khoa. Dựa trên nội dung bài học sau, hãy tạo ra 5 câu hỏi trắc nghiệm **hoàn toàn mới và khác biệt** với những câu đã có.
    
    **NỘI DUNG BÀI HỌC:**
    ${context}
    
    **CÁC CÂU HỎI ĐÃ CÓ (KHÔNG ĐƯỢỢC LẶP LẠI):**
    - ${existingQuestionsString}
    
    **YÊU CẦU:**
    1.  Tạo chính xác 5 câu hỏi mới.
    2.  ${m2Instruction}
    3.  Các câu hỏi phải đa dạng về độ khó (Easy, Medium, Hard).
    4.  Các lựa chọn sai phải hợp lý và có tính thử thách.
    5.  Cung cấp lời giải thích rõ ràng cho mỗi câu trả lời đúng.
    6.  Tuyệt đối không lặp lại ý tưởng hoặc nội dung từ các câu hỏi đã có.
    7.  **QUAN TRỌNG NHẤT:** Đối với mỗi câu hỏi, bạn BẮT BUỘC phải cung cấp (các) câu trả lời đúng trong mảng \`correctAnswers\`. Nội dung của mỗi chuỗi trong \`correctAnswers\` phải **KHỚP CHÍNH XÁC** với văn bản của một trong các tùy chọn trong mảng \`options\`.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: newQuestionsSchema,
        },
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);

    res.status(200).json(result);

  } catch (error) {
    console.error('Lỗi phía server (generate-questions):', error);
    res.status(500).json({ error: 'Không thể tạo thêm câu hỏi.' });
  }
});


// 4. Khởi động máy chủ
app.listen(PORT, () => {
  console.log(`Backend đang chạy tại http://localhost:${PORT}`);
});
