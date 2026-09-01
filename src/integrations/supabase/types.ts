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
      assignments: {
        Row: {
          conversation_id: string
          created_at: string
          description: string | null
          done_at: string | null
          done_by: string | null
          due_date: string | null
          file_name: string | null
          file_size: number | null
          id: string
          seen_at: string | null
          seen_by: string | null
          status: string
          storage_path: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          seen_at?: string | null
          seen_by?: string | null
          status?: string
          storage_path?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          seen_at?: string | null
          seen_by?: string | null
          status?: string
          storage_path?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      availabilities: {
        Row: {
          created_at: string
          end_time: string
          format: string
          id: string
          start_time: string
          teacher_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          format?: string
          id?: string
          start_time: string
          teacher_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          format?: string
          id?: string
          start_time?: string
          teacher_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      availability_exceptions: {
        Row: {
          created_at: string
          end_time: string | null
          exception_date: string
          id: string
          reason: string | null
          start_time: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          exception_date: string
          id?: string
          reason?: string | null
          start_time?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          exception_date?: string
          id?: string
          reason?: string | null
          start_time?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_reschedule_credits: {
        Row: {
          amount_fcfa: number
          applied_at: string | null
          applied_to_booking_id: string | null
          created_at: string
          id: string
          parent_id: string
          source_booking_id: string
          status: string
          teacher_id: string
        }
        Insert: {
          amount_fcfa: number
          applied_at?: string | null
          applied_to_booking_id?: string | null
          created_at?: string
          id?: string
          parent_id: string
          source_booking_id: string
          status?: string
          teacher_id: string
        }
        Update: {
          amount_fcfa?: number
          applied_at?: string | null
          applied_to_booking_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string
          source_booking_id?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reschedule_credits_applied_to_booking_id_fkey"
            columns: ["applied_to_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reschedule_credits_source_booking_id_fkey"
            columns: ["source_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_count: number
          reschedule_previous_at: string | null
          reschedule_proposed_at: string | null
          reschedule_proposed_by: string | null
          reschedule_proposed_fee_rate: number | null
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          child_id?: string | null
          city?: string
          commune?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          format?: string
          id?: string
          is_recurring?: boolean
          message?: string | null
          no_show_reported_at?: string | null
          no_show_reported_by?: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date?: string | null
          requester_id: string
          reschedule_count?: number
          reschedule_previous_at?: string | null
          reschedule_proposed_at?: string | null
          reschedule_proposed_by?: string | null
          reschedule_proposed_fee_rate?: number | null
          scheduled_at: string
          status?: string
          status_reason?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          child_id?: string | null
          city?: string
          commune?: string | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          format?: string
          id?: string
          is_recurring?: boolean
          message?: string | null
          no_show_reported_at?: string | null
          no_show_reported_by?: string | null
          offer_id?: string
          price_fcfa?: number
          recurrence_end_date?: string | null
          requester_id?: string
          reschedule_count?: number
          reschedule_previous_at?: string | null
          reschedule_proposed_at?: string | null
          reschedule_proposed_by?: string | null
          reschedule_proposed_fee_rate?: number | null
          scheduled_at?: string
          status?: string
          status_reason?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "teacher_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      children: {
        Row: {
          auth_user_id: string | null
          birth_year: number | null
          created_at: string
          first_name: string
          id: string
          notes: string | null
          parent_id: string
          school_level: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          birth_year?: number | null
          created_at?: string
          first_name: string
          id?: string
          notes?: string | null
          parent_id: string
          school_level?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          birth_year?: number | null
          created_at?: string
          first_name?: string
          id?: string
          notes?: string | null
          parent_id?: string
          school_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          child_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          learner_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          learner_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          learner_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          against_id: string | null
          booking_id: string
          created_at: string
          description: string | null
          id: string
          opened_by: string
          reason: string
          refund_decision_fcfa: number | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          against_id?: string | null
          booking_id: string
          created_at?: string
          description?: string | null
          id?: string
          opened_by: string
          reason: string
          refund_decision_fcfa?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          against_id?: string | null
          booking_id?: string
          created_at?: string
          description?: string | null
          id?: string
          opened_by?: string
          reason?: string
          refund_decision_fcfa?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          stage: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          stage?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          stage?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_levels: {
        Row: {
          level_id: string
          offer_id: string
        }
        Insert: {
          level_id: string
          offer_id: string
        }
        Update: {
          level_id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_levels_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_levels_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "teacher_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_fcfa: number
          booking_id: string
          cancelled_at: string | null
          commission_fcfa: number
          commission_rate: number
          created_at: string
          escrow_release_at: string | null
          escrow_status: string
          id: string
          method: string
          paid_at: string | null
          payer_id: string
          provider: string
          refund_fcfa: number
          refund_rate: number | null
          refunded_at: string | null
          released_at: string | null
          status: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at: string
        }
        Insert: {
          amount_fcfa: number
          booking_id: string
          cancelled_at?: string | null
          commission_fcfa: number
          commission_rate: number
          created_at?: string
          escrow_release_at?: string | null
          escrow_status?: string
          id?: string
          method?: string
          paid_at?: string | null
          payer_id: string
          provider?: string
          refund_fcfa?: number
          refund_rate?: number | null
          refunded_at?: string | null
          released_at?: string | null
          status?: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at?: string
        }
        Update: {
          amount_fcfa?: number
          booking_id?: string
          cancelled_at?: string | null
          commission_fcfa?: number
          commission_rate?: number
          created_at?: string
          escrow_release_at?: string | null
          escrow_status?: string
          id?: string
          method?: string
          paid_at?: string | null
          payer_id?: string
          provider?: string
          refund_fcfa?: number
          refund_rate?: number | null
          refunded_at?: string | null
          released_at?: string | null
          status?: string
          teacher_id?: string
          teacher_payout_fcfa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string
          commune: string | null
          created_at: string
          display_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string
          commune?: string | null
          created_at?: string
          display_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string
          commune?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reschedule_ledger: {
        Row: {
          booking_id: string
          created_at: string
          fee_amount_fcfa: number
          fee_payee_id: string | null
          fee_payer_id: string | null
          fee_rate: number
          force_majeure_reason: string | null
          id: string
          is_force_majeure: boolean
          new_scheduled_at: string
          previous_scheduled_at: string
          requested_by: string
          reschedule_number: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          fee_amount_fcfa?: number
          fee_payee_id?: string | null
          fee_payer_id?: string | null
          fee_rate?: number
          force_majeure_reason?: string | null
          id?: string
          is_force_majeure?: boolean
          new_scheduled_at: string
          previous_scheduled_at: string
          requested_by: string
          reschedule_number: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          fee_amount_fcfa?: number
          fee_payee_id?: string | null
          fee_payer_id?: string | null
          fee_rate?: number
          force_majeure_reason?: string | null
          id?: string
          is_force_majeure?: boolean
          new_scheduled_at?: string
          previous_scheduled_at?: string
          requested_by?: string
          reschedule_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "reschedule_ledger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_documents: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          kind: string
          note: string | null
          storage_path: string
          teacher_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          note?: string | null
          storage_path: string
          teacher_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          note?: string | null
          storage_path?: string
          teacher_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      teacher_educations: {
        Row: {
          created_at: string
          degree: string
          end_year: number | null
          field: string | null
          honors: string | null
          id: string
          school: string
          sort_order: number
          start_year: number | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          degree: string
          end_year?: number | null
          field?: string | null
          honors?: string | null
          id?: string
          school: string
          sort_order?: number
          start_year?: number | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          degree?: string
          end_year?: number | null
          field?: string | null
          honors?: string | null
          id?: string
          school?: string
          sort_order?: number
          start_year?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_experiences: {
        Row: {
          created_at: string
          description: string | null
          end_year: number | null
          id: string
          is_current: boolean
          organization: string | null
          role_title: string
          sort_order: number
          start_year: number | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          organization?: string | null
          role_title: string
          sort_order?: number
          start_year?: number | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          organization?: string | null
          role_title?: string
          sort_order?: number
          start_year?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_offers: {
        Row: {
          city: string
          communes: string[]
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          offers_home: boolean
          offers_online: boolean
          price_fcfa: number
          status: string
          subject_id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          city?: string
          communes?: string[]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          offers_home?: boolean
          offers_online?: boolean
          price_fcfa: number
          status?: string
          subject_id: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          city?: string
          communes?: string[]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          offers_home?: boolean
          offers_online?: boolean
          price_fcfa?: number
          status?: string
          subject_id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_offers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          bio: string | null
          created_at: string
          headline: string | null
          id: string
          identity_verified: boolean
          intro_video_url: string | null
          languages: string[]
          main_degree: string | null
          offers_home: boolean
          offers_online: boolean
          qualifications_verified: boolean
          teaching_method: string | null
          updated_at: string
          user_id: string
          verification_decided_at: string | null
          verification_note: string | null
          verification_status: string
          verification_submitted_at: string | null
          years_experience: number | null
          zones: string[]
        }
        Insert: {
          bio?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          identity_verified?: boolean
          intro_video_url?: string | null
          languages?: string[]
          main_degree?: string | null
          offers_home?: boolean
          offers_online?: boolean
          qualifications_verified?: boolean
          teaching_method?: string | null
          updated_at?: string
          user_id: string
          verification_decided_at?: string | null
          verification_note?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          years_experience?: number | null
          zones?: string[]
        }
        Update: {
          bio?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          identity_verified?: boolean
          intro_video_url?: string | null
          languages?: string[]
          main_degree?: string | null
          offers_home?: boolean
          offers_online?: boolean
          qualifications_verified?: boolean
          teaching_method?: string | null
          updated_at?: string
          user_id?: string
          verification_decided_at?: string | null
          verification_note?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          years_experience?: number | null
          zones?: string[]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_can_read_conversation: {
        Args: { p_conversation_id: string; p_user: string }
        Returns: boolean
      }
      admin_list_teachers: {
        Args: never
        Returns: {
          city: string
          commune: string
          created_at: string
          display_name: string
          documents_total: number
          headline: string
          identity_verified: boolean
          offers_published: number
          offers_total: number
          phone: string
          qualifications_verified: boolean
          teacher_id: string
          verification_decided_at: string
          verification_note: string
          verification_status: string
          verification_submitted_at: string
          years_experience: number
        }[]
      }
      admin_moderate_offer: {
        Args: { p_offer_id: string; p_reason?: string; p_status: string }
        Returns: {
          city: string
          communes: string[]
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          offers_home: boolean
          offers_online: boolean
          price_fcfa: number
          status: string
          subject_id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_read_dispute_conversation: {
        Args: { p_dispute_id: string }
        Returns: Json
      }
      admin_resolve_dispute: {
        Args: {
          p_dispute_id: string
          p_refund_fcfa?: number
          p_reschedule_to?: string
          p_resolution?: string
          p_status: string
        }
        Returns: {
          against_id: string | null
          booking_id: string
          created_at: string
          description: string | null
          id: string
          opened_by: string
          reason: string
          refund_decision_fcfa: number | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_review_teacher_document: {
        Args: { p_document_id: string; p_note?: string; p_status: string }
        Returns: {
          created_at: string
          file_name: string | null
          id: string
          kind: string
          note: string | null
          storage_path: string
          teacher_id: string
          updated_at: string
          verification_status: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_teacher_verification:
        | {
            Args: {
              p_identity_verified: boolean
              p_qualifications_verified: boolean
              p_teacher_id: string
              p_verification_status: string
            }
            Returns: {
              bio: string | null
              created_at: string
              headline: string | null
              id: string
              identity_verified: boolean
              intro_video_url: string | null
              languages: string[]
              main_degree: string | null
              offers_home: boolean
              offers_online: boolean
              qualifications_verified: boolean
              teaching_method: string | null
              updated_at: string
              user_id: string
              verification_decided_at: string | null
              verification_note: string | null
              verification_status: string
              verification_submitted_at: string | null
              years_experience: number | null
              zones: string[]
            }
            SetofOptions: {
              from: "*"
              to: "teacher_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_identity_verified: boolean
              p_note?: string
              p_qualifications_verified: boolean
              p_teacher_id: string
              p_verification_status: string
            }
            Returns: {
              bio: string | null
              created_at: string
              headline: string | null
              id: string
              identity_verified: boolean
              intro_video_url: string | null
              languages: string[]
              main_degree: string | null
              offers_home: boolean
              offers_online: boolean
              qualifications_verified: boolean
              teaching_method: string | null
              updated_at: string
              user_id: string
              verification_decided_at: string | null
              verification_note: string | null
              verification_status: string
              verification_submitted_at: string | null
              years_experience: number | null
              zones: string[]
            }
            SetofOptions: {
              from: "*"
              to: "teacher_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_booking_payment: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: {
          amount_fcfa: number
          booking_id: string
          cancelled_at: string | null
          commission_fcfa: number
          commission_rate: number
          created_at: string
          escrow_release_at: string | null
          escrow_status: string
          id: string
          method: string
          paid_at: string | null
          payer_id: string
          provider: string
          refund_fcfa: number
          refund_rate: number | null
          refunded_at: string | null
          released_at: string | null
          status: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_reschedule_proposal: {
        Args: { p_booking_id: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_count: number
          reschedule_previous_at: string | null
          reschedule_proposed_at: string | null
          reschedule_proposed_by: string | null
          reschedule_proposed_fee_rate: number | null
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_booking: {
        Args: { p_booking_id: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conversation_role: {
        Args: { p_conversation_id: string; p_user: string }
        Returns: string
      }
      create_booking_payment: {
        Args: { p_booking_id: string }
        Returns: {
          amount_fcfa: number
          booking_id: string
          cancelled_at: string | null
          commission_fcfa: number
          commission_rate: number
          created_at: string
          escrow_release_at: string | null
          escrow_status: string
          id: string
          method: string
          paid_at: string | null
          payer_id: string
          provider: string
          refund_fcfa: number
          refund_rate: number | null
          refunded_at: string | null
          released_at: string | null
          status: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_conversation: {
        Args: {
          p_child_id?: string
          p_learner_id?: string
          p_teacher_id: string
        }
        Returns: {
          child_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          learner_id: string
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      force_majeure_reschedule: {
        Args: { p_booking_id: string; p_new_scheduled_at: string; p_reason: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_count: number
          reschedule_previous_at: string | null
          reschedule_proposed_at: string | null
          reschedule_proposed_by: string | null
          reschedule_proposed_fee_rate: number | null
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_teacher_full_public: { Args: { p_teacher_id: string }; Returns: Json }
      get_teacher_public: {
        Args: { p_teacher_id: string }
        Returns: {
          avatar_url: string
          bio: string
          city: string
          commune: string
          display_name: string
          headline: string
          identity_verified: boolean
          qualifications_verified: boolean
          teacher_id: string
          years_experience: number
          zones: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_payment_paid: {
        Args: { p_booking_id: string; p_method?: string }
        Returns: {
          amount_fcfa: number
          booking_id: string
          cancelled_at: string | null
          commission_fcfa: number
          commission_rate: number
          created_at: string
          escrow_release_at: string | null
          escrow_status: string
          id: string
          method: string
          paid_at: string | null
          payer_id: string
          provider: string
          refund_fcfa: number
          refund_rate: number | null
          refunded_at: string | null
          released_at: string | null
          status: string
          teacher_id: string
          teacher_payout_fcfa: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pair_has_booking: {
        Args: { p_child_id: string; p_learner_id: string; p_teacher_id: string }
        Returns: boolean
      }
      propose_reschedule: {
        Args: { p_booking_id: string; p_new_scheduled_at: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_count: number
          reschedule_previous_at: string | null
          reschedule_proposed_at: string | null
          reschedule_proposed_by: string | null
          reschedule_proposed_fee_rate: number | null
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      quote_booking_refund: {
        Args: { p_booking_id: string }
        Returns: {
          amount_fcfa: number
          hours_before: number
          payment_status: string
          policy_label: string
          refund_fcfa: number
          refund_rate: number
        }[]
      }
      report_parent_no_show: {
        Args: { p_booking_id: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_count: number
          reschedule_previous_at: string | null
          reschedule_proposed_at: string | null
          reschedule_proposed_by: string | null
          reschedule_proposed_fee_rate: number | null
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_teacher_no_show: {
        Args: { p_booking_id: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_count: number
          reschedule_previous_at: string | null
          reschedule_proposed_at: string | null
          reschedule_proposed_by: string | null
          reschedule_proposed_fee_rate: number | null
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_reschedule: {
        Args: { p_accept: boolean; p_booking_id: string }
        Returns: {
          address: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          child_id: string | null
          city: string
          commune: string | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          format: string
          id: string
          is_recurring: boolean
          message: string | null
          no_show_reported_at: string | null
          no_show_reported_by: string | null
          offer_id: string
          price_fcfa: number
          recurrence_end_date: string | null
          requester_id: string
          reschedule_count: number
          reschedule_previous_at: string | null
          reschedule_proposed_at: string | null
          reschedule_proposed_by: string | null
          reschedule_proposed_fee_rate: number | null
          scheduled_at: string
          status: string
          status_reason: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_teachers: {
        Args: {
          p_city?: string
          p_commune?: string
          p_format?: string
          p_level_slug?: string
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_offset?: number
          p_query?: string
          p_subject_slug?: string
          p_weekday?: number
        }
        Returns: {
          avatar_url: string
          bio: string
          city: string
          commune: string
          display_name: string
          headline: string
          identity_verified: boolean
          lessons_count: number
          min_price_fcfa: number
          offers_home: boolean
          offers_online: boolean
          qualifications_verified: boolean
          rating_avg: number
          rating_count: number
          sample_offer_id: string
          students_count: number
          subjects: string[]
          teacher_id: string
          teaching_method: string
          years_experience: number
        }[]
      }
      set_assignment_status: {
        Args: { p_assignment_id: string; p_status: string }
        Returns: {
          conversation_id: string
          created_at: string
          description: string | null
          done_at: string | null
          done_by: string | null
          due_date: string | null
          file_name: string | null
          file_size: number | null
          id: string
          seen_at: string | null
          seen_by: string | null
          status: string
          storage_path: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_teacher_verification: {
        Args: never
        Returns: {
          bio: string | null
          created_at: string
          headline: string | null
          id: string
          identity_verified: boolean
          intro_video_url: string | null
          languages: string[]
          main_degree: string | null
          offers_home: boolean
          offers_online: boolean
          qualifications_verified: boolean
          teaching_method: string | null
          updated_at: string
          user_id: string
          verification_decided_at: string | null
          verification_note: string | null
          verification_status: string
          verification_submitted_at: string | null
          years_experience: number | null
          zones: string[]
        }
        SetofOptions: {
          from: "*"
          to: "teacher_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      teacher_recent_assignments: { Args: { p_limit?: number }; Returns: Json }
    }
    Enums: {
      app_role: "parent" | "student" | "teacher" | "admin"
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
      app_role: ["parent", "student", "teacher", "admin"],
    },
  },
} as const
