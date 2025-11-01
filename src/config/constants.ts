// src/config/constants.ts

export const SUPPORTED_CATEGORIES = ["quick", "easy", "healthy"] as const;
export type SupportedCategory = typeof SUPPORTED_CATEGORIES[number];

export const CATEGORY_PROMPT_HINTS: Record<SupportedCategory, string> = {
  quick: "Ưu tiên công thức dưới 20 phút, ít bước, tối giản dụng cụ.",
  easy: "Dành cho người mới bắt đầu, bước rõ ràng, tránh kỹ thuật phức tạp.",
  healthy: "Tối ưu dinh dưỡng, ít dầu mỡ, cân bằng đạm-bột-xơ, gợi ý thay thế lành mạnh.",
};

export const SUPPORTED_LANGUAGES = ["eng", "vi"] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

