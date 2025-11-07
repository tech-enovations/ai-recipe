# 🧩 PRODUCT REQUIREMENT DOCUMENT (PRD)

## 1️⃣. Tổng quan dự án

**Tên dự án:** FitAI – AI Fitness Trainer (MVP)  
**Phiên bản:** v0.1 MVP  

**Mục tiêu:**  
Xây dựng nền tảng web giúp người dùng có AI huấn luyện viên cá nhân hóa, tự động sinh kế hoạch tập luyện (Workout Plan) và Meal Plan dựa trên thông tin cơ thể & mục tiêu của họ.  
Hệ thống theo dõi tiến trình luyện tập, gợi ý điều chỉnh kế hoạch và cung cấp tips tập luyện từ influencer (TikTok, YouTube Fitness).

---

## 2️⃣. Phạm vi MVP

### ✅ Mục tiêu chính:
- AI huấn luyện viên sinh kế hoạch tập luyện + meal plan dựa trên thông tin người dùng.  
- Dashboard theo dõi tiến độ (cân nặng, calo, bài tập).  
- User nhập kết quả tập mỗi ngày (hoặc đánh dấu hoàn thành).  
- AI phản hồi & điều chỉnh nhẹ theo tiến độ.  

### 🚫 Ngoài phạm vi MVP:
- Không có nhận diện hình ảnh (AI detect food, pose detection).  
- Không tích hợp wearable (Apple Watch, Fitbit).  
- Không crawl dữ liệu realtime (sử dụng data static seed).  
- Không có voice coach.  

---

## 3️⃣. Personas (Đối tượng sử dụng)

| Persona | Mô tả | Nhu cầu |
|----------|-------|---------|
| 🧑‍💻 Minh (23t) – dân văn phòng | Bận rộn, muốn tập hiệu quả, không rảnh thuê PT | Cần plan đơn giản, dễ theo, update nhanh |
| 🧑‍🎓 Lan (21t) – sinh viên | Mới tập, sợ sai form, muốn AI hướng dẫn chi tiết | Cần bài tập đơn giản, dễ hiểu |
| 💪 Tuấn (26t) – người tập lâu | Có kinh nghiệm, muốn tracking nâng tạ | Cần log trọng lượng, biểu đồ tiến độ |

---

## 4️⃣. Functional Requirements (Yêu cầu chức năng)

### 4.1. Authentication & User Profile

**Mục tiêu:** Lưu hồ sơ & mục tiêu tập luyện  
**Luồng:**  
1. Đăng ký bằng Email / Google  
2. Nhập thông tin ban đầu:  
   - Giới tính, tuổi, chiều cao, cân nặng  
   - Mục tiêu: tăng cơ / giảm mỡ / duy trì  
   - Mức độ hoạt động (1–5)  
3. Lưu thông tin vào DB

**Data Structure:**
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "gender": "male|female",
  "age": 24,
  "height": 175,
  "weight": 70,
  "goal": "gain_muscle",
  "activityLevel": 3
}
```

---

### 4.2. AI Trainer (Workout & Meal Plan Generation)

**Mục tiêu:** Sinh kế hoạch tự động phù hợp người dùng.

**Input:**
- Dữ liệu user profile (gender, weight, goal…)  
- Dataset seed (influencer plan + RAG tips)

**Output:**
```json
{
  "workoutPlan": [
    { "day": "Monday", "focus": "Chest", "exercises": [
      {"name": "Bench Press", "sets": 4, "reps": 10, "video": "https://..."}
    ]}
  ],
  "mealPlan": [
    {"meal": "Breakfast", "items": ["Oatmeal", "Egg Whites"], "calories": 450}
  ]
}
```

**Yêu cầu:**
- AI model trả về kế hoạch dạng JSON  
- Frontend hiển thị plan theo tuần (7-day view)  
- Có nút “Regenerate Plan” để AI tạo lại  

---

### 4.3. Workout Tracker

**Mục tiêu:** Ghi nhận tiến độ tập luyện của user.

**Tính năng:**
- Nút “Hoàn thành buổi tập”  
- Log lại thông tin bài tập (set, rep, weight)  
- Lưu lịch sử và hiển thị biểu đồ tiến độ

**Data Example:**
```json
{
  "userId": "uuid",
  "date": "2025-11-07",
  "exercise": "Bench Press",
  "weight": 60,
  "reps": 10,
  "sets": 4,
  "status": "done"
}
```

**UI:**
- Daily summary card: “Bạn đã hoàn thành 4/5 bài tập hôm nay!”  
- Chart: Biểu đồ tăng tạ / reps / ngày tập  

---

### 4.4. Meal Tracker

**Mục tiêu:** Theo dõi lượng calo và macro.

**Tính năng:**
- Người dùng nhập món ăn hoặc chọn từ meal plan có sẵn  
- Tự động tính tổng calo  
- Hiển thị % hoàn thành mục tiêu calo/ngày

**UI:**
- Pie chart: Calo phân bổ theo bữa (Breakfast / Lunch / Dinner)  
- Bar chart: Calories intake vs Plan  

---

### 4.5. Dashboard

**Mục tiêu:** Giao diện trung tâm tổng hợp dữ liệu.

**Hiển thị:**
- Cân nặng (progress chart)  
- Calo nạp / tiêu  
- Lịch sử tập  
- Lời khuyên AI Coach (“Tốt lắm, tuần này bạn tăng 10% sức mạnh Bench Press!”)  

---

### 4.6. AI Feedback Module

**Mục tiêu:** Cập nhật lời khuyên mỗi tuần.

**Luồng:**  
1. User hoàn thành 1 tuần  
2. Gửi dữ liệu tiến độ cho AI  
3. AI phản hồi → sinh text  
> “Bạn đang tăng cơ tốt, hãy thêm 1 bữa phụ chứa protein mỗi ngày.”

**Data:**
```json
{
  "userId": "uuid",
  "weekStats": {
    "avgWeightLifted": 65,
    "avgCalories": 2200
  },
  "aiFeedback": "Hãy tăng thêm 5% mức tạ tuần tới."
}
```

---

## 5️⃣. Non-Functional Requirements (Phi chức năng)

| Hạng mục | Mô tả |
|-----------|--------|
| ⏱ Hiệu năng | Tải dashboard < 2s |
| 🔐 Bảo mật | Supabase Auth / JWT |
| ☁️ Lưu trữ | Supabase (PostgreSQL + Storage) |
| 💾 Cache | Redis / Supabase cache |
| 🤖 AI | OpenAI GPT-4o hoặc Claude 3 Haiku (RAG dataset seed) |
| 🧠 RAG Source | Crawled TikTok / YouTube / Blogs fitness |
| 🎨 UI | Tailwind + Shadcn + Chart.js |
| 📱 Responsive | Web-first (mobile friendly PWA) |

---

## 6️⃣. Kiến trúc hệ thống (MVP)

```
Frontend (Next.js)
 ├── Auth / Profile UI
 ├── Dashboard / Chart / Plan UI
 └── Chat with AI Trainer
       ↓
Backend (NestJS)
 ├── Auth Controller (Supabase)
 ├── User / Plan / Progress APIs
 ├── AI Engine (OpenAI / LangChain)
 ├── Vector DB (Supabase Vector)
 └── Scheduler (Weekly AI Feedback)
```

---

## 7️⃣. Database Schema (MVP)

| Table | Mô tả | Fields chính |
|--------|--------|---------------|
| users | thông tin user | id, name, gender, goal |
| plans | workout + meal plan | id, userId, planType, jsonData |
| progress | log tập | id, userId, date, exercise, weight |
| meals | log ăn uống | id, userId, date, calories, protein, carb, fat |
| feedback | phản hồi AI | id, userId, week, text |

---

## 8️⃣. Success Metrics (MVP)

| Chỉ số | Mục tiêu |
|--------|-----------|
| % user tạo plan đầu tiên | >80% |
| % user hoàn thành tuần đầu | >50% |
| Thời gian trung bình trên site | >5 phút/ngày |
| Số lần chat AI mỗi user/tuần | ≥3 |

---

## 9️⃣. Future Roadmap (Beyond MVP)

| Phiên bản | Tính năng bổ sung |
|------------|------------------|
| v1.1 | Crawl TikTok realtime (fitness dataset RAG) |
| v1.2 | Image food detection (OCR AI) |
| v1.3 | Smartwatch sync (Fitbit/Apple Health) |
| v1.4 | Voice Trainer (Realtime coaching) |
| v2.0 | Community & AI Challenge Leaderboard |

---

## 🔟. UX Flow (MVP Summary)

```
[Login/SignUp] → [Enter Body Info] → [AI Generate Plan]
→ [Dashboard] → [Mark as Done] → [AI Feedback Weekly]
```
