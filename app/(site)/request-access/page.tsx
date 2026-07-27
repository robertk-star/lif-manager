"use client";

import { useState } from "react";
import { PRACTICE_AREAS, MONTHLY_CAPACITIES } from "@/lib/validation";

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  firmName: "",
  email: "",
  phone: "",
  statesServed: "",
  practiceArea: "" as string,
  monthlyLeadCapacity: "" as string,
  website: "",
  message: "",
  companyWebsite: "",
};

type FormState = typeof INITIAL_FORM;
type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";
  if (!form.firmName.trim()) errors.firmName = "Firm or organization name is required.";
  if (!form.email.trim()) errors.email = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = "Enter a valid email address.";
  if (!form.phone.trim()) errors.phone = "Phone number is required.";
  if (!form.statesServed.trim()) errors.statesServed = "State(s) served is required.";
  if (!form.practiceArea) errors.practiceArea = "Select a practice area.";
  if (!form.monthlyLeadCapacity) errors.monthlyLeadCapacity = "Select an estimated monthly capacity.";
  return errors;
}

export default function RequestAccessPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormState]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/partner-access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) setSuccess(true);
      else setApiError(data.error ?? "An error occurred. Please try again.");
    } catch {
      setApiError(
        "Unable to submit. Please try again or email partners@legalintakeflow.com."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Request Received</h1>
          <p className="text-lg text-gray-600">Thank you. Your request has been received.</p>
          <p className="mt-2 text-gray-600">Our team will review your information and contact you shortly.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-[#0d1b2e] py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">Partner Program</p>
          <h1 className="mb-3 text-4xl font-bold text-white sm:text-5xl">Request Partner Access</h1>
          <p className="text-lg text-gray-300">
            Complete the form below to apply for partner access.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="firmName" className="mb-1 block text-sm font-medium text-gray-700">
                Firm or Organization Name *
              </label>
              <input
                id="firmName"
                name="firmName"
                value={form.firmName}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {errors.firmName && <p className="mt-1 text-xs text-red-600">{errors.firmName}</p>}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                  Phone *
                </label>
                <input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="statesServed" className="mb-1 block text-sm font-medium text-gray-700">
                State(s) Served *
              </label>
              <input
                id="statesServed"
                name="statesServed"
                value={form.statesServed}
                onChange={handleChange}
                placeholder="e.g. Texas, California"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {errors.statesServed && <p className="mt-1 text-xs text-red-600">{errors.statesServed}</p>}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="practiceArea" className="mb-1 block text-sm font-medium text-gray-700">
                  Practice Area *
                </label>
                <select
                  id="practiceArea"
                  name="practiceArea"
                  value={form.practiceArea}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select practice area</option>
                  {PRACTICE_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                {errors.practiceArea && <p className="mt-1 text-xs text-red-600">{errors.practiceArea}</p>}
              </div>
              <div>
                <label htmlFor="monthlyLeadCapacity" className="mb-1 block text-sm font-medium text-gray-700">
                  Monthly Capacity *
                </label>
                <select
                  id="monthlyLeadCapacity"
                  name="monthlyLeadCapacity"
                  value={form.monthlyLeadCapacity}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select capacity</option>
                  {MONTHLY_CAPACITIES.map((cap) => (
                    <option key={cap} value={cap}>
                      {cap}
                    </option>
                  ))}
                </select>
                {errors.monthlyLeadCapacity && (
                  <p className="mt-1 text-xs text-red-600">{errors.monthlyLeadCapacity}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="website" className="mb-1 block text-sm font-medium text-gray-700">
                Website (optional)
              </label>
              <input
                id="website"
                name="website"
                value={form.website}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="message" className="mb-1 block text-sm font-medium text-gray-700">
                Message (optional)
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                value={form.message}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="hidden" aria-hidden="true">
              <input
                name="companyWebsite"
                value={form.companyWebsite}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {apiError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Request Partner Access"}
            </button>

            <p className="text-center text-xs text-gray-500">
              By submitting you agree to our <a href="/privacy" className="underline">Privacy Policy</a> and{" "}
              <a href="/terms" className="underline">Terms of Use</a>.
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
