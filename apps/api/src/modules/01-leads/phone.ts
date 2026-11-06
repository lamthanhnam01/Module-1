
export type PhoneResult = {
  phone: string;
  phoneUnverified: boolean;
};

export function normalizePhone(input: string): PhoneResult {
  const original = input.trim();

  // Loại bỏ khoảng trắng, dấu chấm, gạch ngang, ngoặc
  const cleaned = original.replace(/[\s().-]/g, "");

  let phone = cleaned;

  // Chuyển +84 hoặc 84 về số bắt đầu bằng 0
  if (phone.startsWith("+84")) {
    phone = "0" + phone.slice(3);
  } else if (phone.startsWith("84")) {
    phone = "0" + phone.slice(2);
  }

  // Kiểm tra định dạng số di động Việt Nam
  const isValid = /^0[35789]\d{8}$/.test(phone);

  return {
    phone: isValid ? phone : original,
    phoneUnverified: !isValid,
  };
}
