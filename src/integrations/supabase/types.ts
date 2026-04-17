export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          workspace_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          workspace_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      disbursals: {
        Row: {
          commission_amount: number
          created_at: string
          customer_paid_at: string | null
          disbursed_amount: number
          disbursed_at: string | null
          docs_clear_at: string | null
          dsa_id: string
          id: string
          lead_id: string
          lead_purchase_id: string
          lender_id: string | null
          lender_name: string | null
          loan_account_no: string | null
          notes: string | null
          payout_due_at: string | null
          payout_eligible_at: string | null
          payout_id: string | null
          status: Database["public"]["Enums"]["disbursal_status"]
          updated_at: string
          webhook_payload: Json | null
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          customer_paid_at?: string | null
          disbursed_amount?: number
          disbursed_at?: string | null
          docs_clear_at?: string | null
          dsa_id: string
          id?: string
          lead_id: string
          lead_purchase_id: string
          lender_id?: string | null
          lender_name?: string | null
          loan_account_no?: string | null
          notes?: string | null
          payout_due_at?: string | null
          payout_eligible_at?: string | null
          payout_id?: string | null
          status?: Database["public"]["Enums"]["disbursal_status"]
          updated_at?: string
          webhook_payload?: Json | null
        }
        Update: {
          commission_amount?: number
          created_at?: string
          customer_paid_at?: string | null
          disbursed_amount?: number
          disbursed_at?: string | null
          docs_clear_at?: string | null
          dsa_id?: string
          id?: string
          lead_id?: string
          lead_purchase_id?: string
          lender_id?: string | null
          lender_name?: string | null
          loan_account_no?: string | null
          notes?: string | null
          payout_due_at?: string | null
          payout_eligible_at?: string | null
          payout_id?: string | null
          status?: Database["public"]["Enums"]["disbursal_status"]
          updated_at?: string
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "disbursals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursals_lead_purchase_id_fkey"
            columns: ["lead_purchase_id"]
            isOneToOne: false
            referencedRelation: "lead_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          bank_account: string | null
          created_at: string
          ctc: number
          department: string | null
          designation: string | null
          email: string | null
          employee_code: string
          full_name: string
          id: string
          ifsc: string | null
          join_date: string
          pan: string | null
          phone: string | null
          reports_to: string | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          bank_account?: string | null
          created_at?: string
          ctc?: number
          department?: string | null
          designation?: string | null
          email?: string | null
          employee_code: string
          full_name: string
          id?: string
          ifsc?: string | null
          join_date?: string
          pan?: string | null
          phone?: string | null
          reports_to?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          bank_account?: string | null
          created_at?: string
          ctc?: number
          department?: string | null
          designation?: string | null
          email?: string | null
          employee_code?: string
          full_name?: string
          id?: string
          ifsc?: string | null
          join_date?: string
          pan?: string | null
          phone?: string | null
          reports_to?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_purchases: {
        Row: {
          converted: boolean
          created_at: string
          deal_value: number
          dsa_id: string
          id: string
          lead_id: string
          next_followup_at: string | null
          notes: Json
          pipeline_stage: string
          price_paid: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          converted?: boolean
          created_at?: string
          deal_value?: number
          dsa_id: string
          id?: string
          lead_id: string
          next_followup_at?: string | null
          notes?: Json
          pipeline_stage?: string
          price_paid: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          converted?: boolean
          created_at?: string
          deal_value?: number
          dsa_id?: string
          id?: string
          lead_id?: string
          next_followup_at?: string | null
          notes?: Json
          pipeline_stage?: string
          price_paid?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_purchases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_refunds: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          description: string | null
          dsa_id: string
          evidence_urls: string[] | null
          id: string
          lead_id: string
          lead_purchase_id: string
          reason: Database["public"]["Enums"]["refund_reason"]
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description?: string | null
          dsa_id: string
          evidence_urls?: string[] | null
          id?: string
          lead_id: string
          lead_purchase_id: string
          reason: Database["public"]["Enums"]["refund_reason"]
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description?: string | null
          dsa_id?: string
          evidence_urls?: string[] | null
          id?: string
          lead_id?: string
          lead_purchase_id?: string
          reason?: Database["public"]["Enums"]["refund_reason"]
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_refunds_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_refunds_lead_purchase_id_fkey"
            columns: ["lead_purchase_id"]
            isOneToOne: false
            referencedRelation: "lead_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          age: number | null
          alternate_phone: string | null
          applicant_name: string
          assigned_to: string | null
          campaign_name: string | null
          card_type: string | null
          cibil_score: number | null
          city: string
          company_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          employment_type: string | null
          family_members: number | null
          follow_up_date: string | null
          fraud_risk: string
          full_phone: string
          gender: string | null
          id: string
          internal_notes: string | null
          loan_amount: number
          loan_type: Database["public"]["Enums"]["loan_type"]
          masked_phone: string
          monthly_income: number | null
          next_call_date: string | null
          notes: string | null
          phone_verified: boolean
          price: number
          product_category: Database["public"]["Enums"]["product_category"]
          product_details: Json
          product_subtype: string | null
          product_type_id: string | null
          quality_factors: Json
          quality_score: number | null
          remarks: string | null
          sale_available: boolean
          score: Database["public"]["Enums"]["lead_score"]
          source: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          sum_insured: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          age?: number | null
          alternate_phone?: string | null
          applicant_name: string
          assigned_to?: string | null
          campaign_name?: string | null
          card_type?: string | null
          cibil_score?: number | null
          city: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          employment_type?: string | null
          family_members?: number | null
          follow_up_date?: string | null
          fraud_risk?: string
          full_phone: string
          gender?: string | null
          id?: string
          internal_notes?: string | null
          loan_amount: number
          loan_type: Database["public"]["Enums"]["loan_type"]
          masked_phone: string
          monthly_income?: number | null
          next_call_date?: string | null
          notes?: string | null
          phone_verified?: boolean
          price?: number
          product_category?: Database["public"]["Enums"]["product_category"]
          product_details?: Json
          product_subtype?: string | null
          product_type_id?: string | null
          quality_factors?: Json
          quality_score?: number | null
          remarks?: string | null
          sale_available?: boolean
          score?: Database["public"]["Enums"]["lead_score"]
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          sum_insured?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          age?: number | null
          alternate_phone?: string | null
          applicant_name?: string
          assigned_to?: string | null
          campaign_name?: string | null
          card_type?: string | null
          cibil_score?: number | null
          city?: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          employment_type?: string | null
          family_members?: number | null
          follow_up_date?: string | null
          fraud_risk?: string
          full_phone?: string
          gender?: string | null
          id?: string
          internal_notes?: string | null
          loan_amount?: number
          loan_type?: Database["public"]["Enums"]["loan_type"]
          masked_phone?: string
          monthly_income?: number | null
          next_call_date?: string | null
          notes?: string | null
          phone_verified?: boolean
          price?: number
          product_category?: Database["public"]["Enums"]["product_category"]
          product_details?: Json
          product_subtype?: string | null
          product_type_id?: string | null
          quality_factors?: Json
          quality_score?: number | null
          remarks?: string | null
          sale_available?: boolean
          score?: Database["public"]["Enums"]["lead_score"]
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          sum_insured?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          created_at: string
          custom_text: Json
          downloads: number
          id: string
          kind: Database["public"]["Enums"]["marketing_template_kind"]
          product: Database["public"]["Enums"]["marketing_product"]
          referral_code: string | null
          share_url: string | null
          shares: number
          template_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_text?: Json
          downloads?: number
          id?: string
          kind?: Database["public"]["Enums"]["marketing_template_kind"]
          product?: Database["public"]["Enums"]["marketing_product"]
          referral_code?: string | null
          share_url?: string | null
          shares?: number
          template_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_text?: Json
          downloads?: number
          id?: string
          kind?: Database["public"]["Enums"]["marketing_template_kind"]
          product?: Database["public"]["Enums"]["marketing_product"]
          referral_code?: string | null
          share_url?: string | null
          shares?: number
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "marketing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_templates: {
        Row: {
          active_from: string | null
          active_until: string | null
          body: string | null
          category: string
          created_at: string
          created_by: string | null
          cta: string
          display_order: number
          enabled: boolean
          festival: string | null
          headline: string
          id: string
          is_daily: boolean
          is_trending: boolean
          kind: Database["public"]["Enums"]["marketing_template_kind"]
          name: string
          product: Database["public"]["Enums"]["marketing_product"]
          subheadline: string | null
          tags: string[]
          theme: Json
          updated_at: string
        }
        Insert: {
          active_from?: string | null
          active_until?: string | null
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          display_order?: number
          enabled?: boolean
          festival?: string | null
          headline: string
          id?: string
          is_daily?: boolean
          is_trending?: boolean
          kind?: Database["public"]["Enums"]["marketing_template_kind"]
          name: string
          product?: Database["public"]["Enums"]["marketing_product"]
          subheadline?: string | null
          tags?: string[]
          theme?: Json
          updated_at?: string
        }
        Update: {
          active_from?: string | null
          active_until?: string | null
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          display_order?: number
          enabled?: boolean
          festival?: string | null
          headline?: string
          id?: string
          is_daily?: boolean
          is_trending?: boolean
          kind?: Database["public"]["Enums"]["marketing_template_kind"]
          name?: string
          product?: Database["public"]["Enums"]["marketing_product"]
          subheadline?: string | null
          tags?: string[]
          theme?: Json
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          account_holder: string | null
          admin_notes: string | null
          amount: number
          bank_account: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          ifsc: string | null
          method: Database["public"]["Enums"]["payout_method"]
          paid_at: string | null
          reject_reason: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          transaction_ref: string | null
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          account_holder?: string | null
          admin_notes?: string | null
          amount: number
          bank_account?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          ifsc?: string | null
          method: Database["public"]["Enums"]["payout_method"]
          paid_at?: string | null
          reject_reason?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          transaction_ref?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          account_holder?: string | null
          admin_notes?: string | null
          amount?: number
          bank_account?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          ifsc?: string | null
          method?: Database["public"]["Enums"]["payout_method"]
          paid_at?: string | null
          reject_reason?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          transaction_ref?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          deductions: Json
          earnings: Json
          employee_id: string
          generated_at: string
          gross: number
          id: string
          net_pay: number
          paid_at: string | null
          paid_days: number
          period_month: number
          period_year: number
          status: Database["public"]["Enums"]["payslip_status"]
          total_deductions: number
          working_days: number
          workspace_id: string
        }
        Insert: {
          deductions?: Json
          earnings?: Json
          employee_id: string
          generated_at?: string
          gross?: number
          id?: string
          net_pay?: number
          paid_at?: string | null
          paid_days?: number
          period_month: number
          period_year: number
          status?: Database["public"]["Enums"]["payslip_status"]
          total_deductions?: number
          working_days?: number
          workspace_id: string
        }
        Update: {
          deductions?: Json
          earnings?: Json
          employee_id?: string
          generated_at?: string
          gross?: number
          id?: string
          net_pay?: number
          paid_at?: string | null
          paid_days?: number
          period_month?: number
          period_year?: number
          status?: Database["public"]["Enums"]["payslip_status"]
          total_deductions?: number
          working_days?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          media_type: string
          product: Database["public"]["Enums"]["marketing_product"]
          prompt: string | null
          source: string
          tags: string[]
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          media_type?: string
          product?: Database["public"]["Enums"]["marketing_product"]
          prompt?: string | null
          source?: string
          tags?: string[]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          media_type?: string
          product?: Database["public"]["Enums"]["marketing_product"]
          prompt?: string | null
          source?: string
          tags?: string[]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_pipelines: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          id: string
          name: string
          stages: Json
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          name: string
          stages?: Json
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          name?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: []
      }
      product_types: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          code: string
          color: string | null
          commission_flat_max: number
          commission_flat_min: number
          commission_pct_max: number
          commission_pct_min: number
          created_at: string
          default_lead_price: number
          description: string | null
          display_order: number
          enabled: boolean
          high_commission: boolean
          high_demand: boolean
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          code: string
          color?: string | null
          commission_flat_max?: number
          commission_flat_min?: number
          commission_pct_max?: number
          commission_pct_min?: number
          created_at?: string
          default_lead_price?: number
          description?: string | null
          display_order?: number
          enabled?: boolean
          high_commission?: boolean
          high_demand?: boolean
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          code?: string
          color?: string | null
          commission_flat_max?: number
          commission_flat_min?: number
          commission_pct_max?: number
          commission_pct_min?: number
          created_at?: string
          default_lead_price?: number
          description?: string | null
          display_order?: number
          enabled?: boolean
          high_commission?: boolean
          high_demand?: boolean
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          company_name: string | null
          created_at: string
          dsa_tier: string
          fraud_flags: number
          full_name: string | null
          id: string
          phone: string | null
          reputation_score: number
          total_conversions: number
          total_leads_purchased: number
          total_refunds: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          dsa_tier?: string
          fraud_flags?: number
          full_name?: string | null
          id: string
          phone?: string | null
          reputation_score?: number
          total_conversions?: number
          total_leads_purchased?: number
          total_refunds?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          dsa_tier?: string
          fraud_flags?: number
          full_name?: string | null
          id?: string
          phone?: string | null
          reputation_score?: number
          total_conversions?: number
          total_leads_purchased?: number
          total_refunds?: number
          updated_at?: string
        }
        Relationships: []
      }
      salary_structures: {
        Row: {
          basic: number
          conveyance: number
          created_at: string
          effective_from: string
          employee_id: string
          hra: number
          id: string
          is_active: boolean
          medical: number
          other_deductions: number
          pf: number
          professional_tax: number
          special_allowance: number
          tds: number
          workspace_id: string
        }
        Insert: {
          basic?: number
          conveyance?: number
          created_at?: string
          effective_from?: string
          employee_id: string
          hra?: number
          id?: string
          is_active?: boolean
          medical?: number
          other_deductions?: number
          pf?: number
          professional_tax?: number
          special_allowance?: number
          tds?: number
          workspace_id: string
        }
        Update: {
          basic?: number
          conveyance?: number
          created_at?: string
          effective_from?: string
          employee_id?: string
          hra?: number
          id?: string
          is_active?: boolean
          medical?: number
          other_deductions?: number
          pf?: number
          professional_tax?: number
          special_allowance?: number
          tds?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_structures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visiting_cards: {
        Row: {
          city: string | null
          company_name: string | null
          created_at: string
          designation: string | null
          email: string | null
          full_name: string
          id: string
          is_default: boolean
          logo_url: string | null
          phone: string
          photo_url: string | null
          products: string[]
          theme: Json
          updated_at: string
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_default?: boolean
          logo_url?: string | null
          phone: string
          photo_url?: string | null
          products?: string[]
          theme?: Json
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_default?: boolean
          logo_url?: string | null
          phone?: string
          photo_url?: string | null
          products?: string[]
          theme?: Json
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description: string
          id?: string
          reference_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_recharged: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_recharged?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_recharged?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          collected_data: Json
          contact_name: string | null
          created_at: string
          current_step: string
          id: string
          last_inbound_at: string | null
          last_message_preview: string | null
          last_outbound_at: string | null
          lead_id: string | null
          product_interest: string | null
          status: Database["public"]["Enums"]["wa_conversation_status"]
          unread_count: number
          updated_at: string
          wa_phone: string
        }
        Insert: {
          assigned_to?: string | null
          collected_data?: Json
          contact_name?: string | null
          created_at?: string
          current_step?: string
          id?: string
          last_inbound_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          product_interest?: string | null
          status?: Database["public"]["Enums"]["wa_conversation_status"]
          unread_count?: number
          updated_at?: string
          wa_phone: string
        }
        Update: {
          assigned_to?: string | null
          collected_data?: Json
          contact_name?: string | null
          created_at?: string
          current_step?: string
          id?: string
          last_inbound_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          product_interest?: string | null
          status?: Database["public"]["Enums"]["wa_conversation_status"]
          unread_count?: number
          updated_at?: string
          wa_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_followups: {
        Row: {
          attempt_count: number
          conversation_id: string
          created_at: string
          error_message: string | null
          id: string
          send_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["wa_followup_status"]
          template_name: string
        }
        Insert: {
          attempt_count?: number
          conversation_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          send_at: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_followup_status"]
          template_name: string
        }
        Update: {
          attempt_count?: number
          conversation_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          send_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_followup_status"]
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_followups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["wa_direction"]
          id: string
          is_bot: boolean
          metadata: Json
          sent_by: string | null
          status: Database["public"]["Enums"]["wa_msg_status"]
          template_name: string | null
          wa_message_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["wa_direction"]
          id?: string
          is_bot?: boolean
          metadata?: Json
          sent_by?: string | null
          status?: Database["public"]["Enums"]["wa_msg_status"]
          template_name?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["wa_direction"]
          id?: string
          is_bot?: boolean
          metadata?: Json
          sent_by?: string | null
          status?: Database["public"]["Enums"]["wa_msg_status"]
          template_name?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["wa_template_category"]
          created_at: string
          enabled: boolean
          id: string
          language: string
          name: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: string
          category?: Database["public"]["Enums"]["wa_template_category"]
          created_at?: string
          enabled?: boolean
          id?: string
          language?: string
          name: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["wa_template_category"]
          created_at?: string
          enabled?: boolean
          id?: string
          language?: string
          name?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          hrms_enabled: boolean
          hrms_price_per_employee: number
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["workspace_plan"]
          seat_limit: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hrms_enabled?: boolean
          hrms_price_per_employee?: number
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: Database["public"]["Enums"]["workspace_plan"]
          seat_limit?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hrms_enabled?: boolean
          hrms_price_per_employee?: number
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["workspace_plan"]
          seat_limit?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_disbursal: {
        Args: {
          _amount?: number
          _disbursal_id: string
          _new_status: Database["public"]["Enums"]["disbursal_status"]
          _notes?: string
        }
        Returns: Json
      }
      dsa_tier_from_score: { Args: { _score: number }; Returns: string }
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_workspaces: {
        Args: { _user_id: string }
        Returns: {
          role: Database["public"]["Enums"]["workspace_role"]
          workspace_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["workspace_role"][]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      hrms_monthly_bill: { Args: { _workspace_id: string }; Returns: Json }
      is_workspace_employee: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: { Args: { _id: string }; Returns: boolean }
      notify: {
        Args: {
          _body?: string
          _link?: string
          _metadata?: Json
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      payout_sla_days: { Args: { _tier: string }; Returns: number }
      plan_seat_limit: {
        Args: { _plan: Database["public"]["Enums"]["workspace_plan"] }
        Returns: number
      }
      process_payout: {
        Args: {
          _action: string
          _admin_notes?: string
          _payout_id: string
          _reject_reason?: string
          _transaction_ref?: string
        }
        Returns: Json
      }
      process_payroll: {
        Args: { _month: number; _workspace_id: string; _year: number }
        Returns: Json
      }
      purchase_lead: { Args: { _lead_id: string }; Returns: Json }
      recalc_reputation: { Args: { _user_id: string }; Returns: number }
      recharge_wallet: { Args: { _amount: number }; Returns: Json }
      request_payout: {
        Args: {
          _account_holder?: string
          _amount: number
          _bank_account?: string
          _ifsc?: string
          _method: Database["public"]["Enums"]["payout_method"]
          _upi_id?: string
        }
        Returns: Json
      }
      submit_refund: {
        Args: {
          _description?: string
          _evidence?: string[]
          _lead_id: string
          _reason: Database["public"]["Enums"]["refund_reason"]
        }
        Returns: Json
      }
      user_locked_payouts: { Args: { _user_id: string }; Returns: number }
      user_paid_commission: { Args: { _user_id: string }; Returns: number }
      user_withdrawable: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role:
        | "admin"
        | "dsa"
        | "caller"
        | "coordinator"
        | "lender"
        | "affiliate"
        | "customer"
      attendance_status:
        | "present"
        | "absent"
        | "half_day"
        | "leave"
        | "holiday"
        | "weekend"
      disbursal_status:
        | "pending"
        | "disbursed"
        | "docs_pending"
        | "docs_clear"
        | "customer_paid"
        | "rejected"
        | "cancelled"
      employee_status: "active" | "on_leave" | "terminated"
      lead_score: "cold" | "warm" | "hot"
      lead_status: "available" | "sold" | "archived"
      loan_type:
        | "personal"
        | "home"
        | "business"
        | "credit_card"
        | "insurance"
        | "mutual_fund"
      marketing_product:
        | "personal_loan"
        | "business_loan"
        | "home_loan"
        | "lap"
        | "msme"
        | "credit_card"
        | "insurance"
        | "investment"
        | "generic"
      marketing_template_kind: "post" | "reel" | "whatsapp" | "visiting_card"
      notification_type:
        | "payout_approved"
        | "payout_paid"
        | "payout_rejected"
        | "refund_approved"
        | "refund_rejected"
        | "disbursal_confirmed"
        | "docs_pending"
        | "docs_clear"
        | "lead_purchased"
        | "lead_assigned"
        | "followup_due"
        | "tier_upgraded"
        | "badge_earned"
        | "course_completed"
        | "system"
        | "marketing"
      payout_method: "bank" | "upi"
      payout_status: "pending" | "approved" | "rejected" | "paid"
      payslip_status: "draft" | "processed" | "paid"
      product_category: "loan" | "insurance" | "credit_card" | "investment"
      refund_reason:
        | "invalid_phone"
        | "wrong_number"
        | "do_not_call"
        | "duplicate"
        | "fake_data"
        | "no_intent"
        | "other"
      refund_status: "pending" | "approved" | "rejected" | "auto_approved"
      txn_type: "credit" | "debit"
      wa_conversation_status: "active" | "qualified" | "closed" | "spam"
      wa_direction: "inbound" | "outbound"
      wa_followup_status: "scheduled" | "sent" | "cancelled" | "failed"
      wa_msg_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "received"
      wa_template_category:
        | "welcome"
        | "menu"
        | "collect_info"
        | "offer"
        | "festival"
        | "reminder"
        | "eligibility"
        | "documents"
        | "custom"
      workspace_plan: "starter" | "growth" | "pro" | "enterprise"
      workspace_role: "owner" | "admin" | "manager" | "employee" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "dsa",
        "caller",
        "coordinator",
        "lender",
        "affiliate",
        "customer",
      ],
      attendance_status: [
        "present",
        "absent",
        "half_day",
        "leave",
        "holiday",
        "weekend",
      ],
      disbursal_status: [
        "pending",
        "disbursed",
        "docs_pending",
        "docs_clear",
        "customer_paid",
        "rejected",
        "cancelled",
      ],
      employee_status: ["active", "on_leave", "terminated"],
      lead_score: ["cold", "warm", "hot"],
      lead_status: ["available", "sold", "archived"],
      loan_type: [
        "personal",
        "home",
        "business",
        "credit_card",
        "insurance",
        "mutual_fund",
      ],
      marketing_product: [
        "personal_loan",
        "business_loan",
        "home_loan",
        "lap",
        "msme",
        "credit_card",
        "insurance",
        "investment",
        "generic",
      ],
      marketing_template_kind: ["post", "reel", "whatsapp", "visiting_card"],
      notification_type: [
        "payout_approved",
        "payout_paid",
        "payout_rejected",
        "refund_approved",
        "refund_rejected",
        "disbursal_confirmed",
        "docs_pending",
        "docs_clear",
        "lead_purchased",
        "lead_assigned",
        "followup_due",
        "tier_upgraded",
        "badge_earned",
        "course_completed",
        "system",
        "marketing",
      ],
      payout_method: ["bank", "upi"],
      payout_status: ["pending", "approved", "rejected", "paid"],
      payslip_status: ["draft", "processed", "paid"],
      product_category: ["loan", "insurance", "credit_card", "investment"],
      refund_reason: [
        "invalid_phone",
        "wrong_number",
        "do_not_call",
        "duplicate",
        "fake_data",
        "no_intent",
        "other",
      ],
      refund_status: ["pending", "approved", "rejected", "auto_approved"],
      txn_type: ["credit", "debit"],
      wa_conversation_status: ["active", "qualified", "closed", "spam"],
      wa_direction: ["inbound", "outbound"],
      wa_followup_status: ["scheduled", "sent", "cancelled", "failed"],
      wa_msg_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "received",
      ],
      wa_template_category: [
        "welcome",
        "menu",
        "collect_info",
        "offer",
        "festival",
        "reminder",
        "eligibility",
        "documents",
        "custom",
      ],
      workspace_plan: ["starter", "growth", "pro", "enterprise"],
      workspace_role: ["owner", "admin", "manager", "employee", "viewer"],
    },
  },
} as const
