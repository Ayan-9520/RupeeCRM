from pathlib import Path

p = Path(r"E:\Projects\leadflowpro\src\routes\apply.$slug.tsx")
text = p.read_text(encoding="utf-8")
start = text.index("  const e164 = (p: string)")
end = text.index("  const waText = useMemo(")
new = r'''  const e164 = (p: string) => `+91${p}`;

  // STEP 1 → create lead on Python CRM
  async function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = step1Schema.safeParse({ loan_amount: loanAmount, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const phoneDigits = parsed.data.phone;
      const masked = `${phoneDigits.slice(0, 2)}XXXXXX${phoneDigits.slice(-2)}`;
      const created = await crmPublicFetch("/api/public/leads", {
        method: "POST",
        body: JSON.stringify({
          applicant_name: name || "Pending",
          full_phone: `+91${phoneDigits}`,
          masked_phone: masked,
          city: city || "Pending",
          loan_amount: parsed.data.loan_amount,
          loan_type: loanType,
          product_category: product.product_category,
          product_subtype: product.product_subtype,
          source: "website",
          utm_source: search.utm_source,
          utm_medium: search.utm_medium,
          utm_campaign: search.utm_campaign,
          is_marketplace: true,
          sale_available: true,
          status: "available",
          score: parsed.data.loan_amount >= 1000000 ? "hot" : parsed.data.loan_amount >= 500000 ? "warm" : "cold",
          product_details: { ref_code: search.ref ?? null, apply_slug: slug },
        }),
      });
      setLeadId(created.id as string);
      setMaskedPhone(masked);
      setIsExclusive(false);
      toast.success("Application started — verify mobile (demo OTP: any 6 digits)");
      setOtpSentAt(Date.now());
      setResendIn(30);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    if (!leadId) return;
    setSubmitting(true);
    try {
      await crmPublicFetch(`/api/public/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ phone_verified: true }),
      });
      setOtpVerified(true);
      toast.success("Phone verified");
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendIn > 0) return;
    toast.success("New OTP sent (demo — enter any 6 digits)");
    setOtpSentAt(Date.now());
    setResendIn(30);
  }

  function skipOtp() {
    toast.info("You can verify later. Continuing…");
    setStep(3);
  }

  async function handleDetailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = step3Schema.safeParse({
      applicant_name: name, city, email,
      monthly_income: monthlyIncome,
      employment_type: employmentType,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!leadId) return;
    setSubmitting(true);
    try {
      await crmPublicFetch(`/api/public/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          applicant_name: parsed.data.applicant_name,
          city: parsed.data.city,
          email: parsed.data.email || null,
          monthly_income: parsed.data.monthly_income || null,
          employment_type: parsed.data.employment_type || null,
        }),
      });
      setStep(4);
      setTimeout(() => setShowTrackPopup(true), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save details";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

'''
p.write_text(text[:start] + new + text[end:], encoding="utf-8")
print("ok", p)
