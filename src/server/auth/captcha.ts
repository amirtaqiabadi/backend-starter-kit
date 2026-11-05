/** Why: OTP request keeps a single hook for a future CAPTCHA without adding a vendor now. */
export async function assertCaptcha(input: { phoneNumber: string; ip: string }): Promise<void> {
  void input.phoneNumber;
  void input.ip;
}
