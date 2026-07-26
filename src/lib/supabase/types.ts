export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          is_admin: boolean;
          is_anonymous: boolean;
          suspended_until: string | null;
          banned_at: string | null;
          suspend_reason: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          is_admin?: boolean;
          is_anonymous?: boolean;
          suspended_until?: string | null;
          banned_at?: string | null;
          suspend_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          is_admin?: boolean;
          is_anonymous?: boolean;
          suspended_until?: string | null;
          banned_at?: string | null;
          suspend_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      polls: {
        Row: {
          id: string;
          owner_id: string;
          question: string;
          status: "pending" | "published" | "rejected" | "hidden";
          category: "일상" | "음식" | "연애" | "게임" | "밸런스" | "기타";
          view_count: number;
          vote_count: number;
          comment_count: number;
          is_pinned: boolean;
          is_featured: boolean;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          question: string;
          status?: "pending" | "published" | "rejected" | "hidden";
          category?: "일상" | "음식" | "연애" | "게임" | "밸런스" | "기타";
          view_count?: number;
          vote_count?: number;
          comment_count?: number;
          is_pinned?: boolean;
          is_featured?: boolean;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          question?: string;
          status?: "pending" | "published" | "rejected" | "hidden";
          category?: "일상" | "음식" | "연애" | "게임" | "밸런스" | "기타";
          view_count?: number;
          vote_count?: number;
          comment_count?: number;
          is_pinned?: boolean;
          is_featured?: boolean;
          deleted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "polls_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          label: string;
          position: number;
          image_path: string | null;
        };
        Insert: {
          id?: string;
          poll_id: string;
          label: string;
          position?: number;
          image_path?: string | null;
        };
        Update: {
          id?: string;
          poll_id?: string;
          label?: string;
          position?: number;
          image_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          }
        ];
      };
      votes: {
        Row: {
          id: string;
          poll_id: string;
          option_id: string;
          voter_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          option_id: string;
          voter_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          poll_id?: string;
          option_id?: string;
          voter_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "votes_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "poll_options";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          poll_id: string;
          author_id: string;
          body: string;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          author_id: string;
          body: string;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          poll_id?: string;
          author_id?: string;
          body?: string;
          deleted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      reports: {
        Row: {
          id: string;
          target_type: "poll" | "comment";
          poll_id: string | null;
          comment_id: string | null;
          reporter_id: string;
          reason: string;
          status: "pending" | "resolved" | "dismissed";
          resolution_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: "poll" | "comment";
          poll_id?: string | null;
          comment_id?: string | null;
          reporter_id: string;
          reason: string;
          status?: "pending" | "resolved" | "dismissed";
          resolution_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          target_type?: "poll" | "comment";
          poll_id?: string | null;
          comment_id?: string | null;
          reporter_id?: string;
          reason?: string;
          status?: "pending" | "resolved" | "dismissed";
          resolution_note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      community_posts: {
        Row: {
          id: string;
          board: "free" | "humor" | "question" | "balance_suggestion";
          author_id: string;
          title: string;
          body: string;
          image_path: string | null;
          view_count: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board: "free" | "humor" | "question" | "balance_suggestion";
          author_id: string;
          title: string;
          body: string;
          image_path?: string | null;
          view_count?: number;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          board?: "free" | "humor" | "question" | "balance_suggestion";
          author_id?: string;
          title?: string;
          body?: string;
          image_path?: string | null;
          view_count?: number;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      community_post_likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_post_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      community_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          body: string;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          body?: string;
          deleted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      community_reports: {
        Row: {
          id: string;
          target_type: "post" | "comment";
          post_id: string | null;
          comment_id: string | null;
          reporter_id: string;
          reason: string;
          status: "pending" | "resolved" | "dismissed";
          resolution_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: "post" | "comment";
          post_id?: string | null;
          comment_id?: string | null;
          reporter_id: string;
          reason: string;
          status?: "pending" | "resolved" | "dismissed";
          resolution_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          target_type?: "post" | "comment";
          post_id?: string | null;
          comment_id?: string | null;
          reporter_id?: string;
          reason?: string;
          status?: "pending" | "resolved" | "dismissed";
          resolution_note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_reports_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "community_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_log: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_type: string;
          target_id: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          target_type: string;
          target_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      notices: {
        Row: {
          id: string;
          title: string;
          body: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      popups: {
        Row: {
          id: string;
          title: string;
          body: string | null;
          image_path: string | null;
          link_url: string | null;
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body?: string | null;
          image_path?: string | null;
          link_url?: string | null;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string | null;
          image_path?: string | null;
          link_url?: string | null;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      banners: {
        Row: {
          id: string;
          kind: "event" | "home";
          title: string;
          image_path: string | null;
          link_url: string | null;
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: "event" | "home";
          title: string;
          image_path?: string | null;
          link_url?: string | null;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          kind?: "event" | "home";
          title?: string;
          image_path?: string | null;
          link_url?: string | null;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      ad_slots: {
        Row: {
          slot_key: string;
          image_path: string | null;
          link_url: string | null;
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          slot_key: string;
          image_path?: string | null;
          link_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          slot_key?: string;
          image_path?: string | null;
          link_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      home_sections: {
        Row: {
          key: string;
          is_visible: boolean;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          key: string;
          is_visible?: boolean;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          key?: string;
          is_visible?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_tasks: {
        Row: {
          id: string;
          role: "report_review" | "content_plan" | "stats_summary";
          status: "completed" | "failed" | "applied" | "dismissed";
          trigger: "manual" | "cron";
          title: string;
          summary: string | null;
          output: Json | null;
          subject_type: string | null;
          subject_id: string | null;
          model: string | null;
          error: string | null;
          created_by: string | null;
          applied_by: string | null;
          applied_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          role: "report_review" | "content_plan" | "stats_summary";
          status?: "completed" | "failed" | "applied" | "dismissed";
          trigger?: "manual" | "cron";
          title: string;
          summary?: string | null;
          output?: Json | null;
          subject_type?: string | null;
          subject_id?: string | null;
          model?: string | null;
          error?: string | null;
          created_by?: string | null;
          applied_by?: string | null;
          applied_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: "report_review" | "content_plan" | "stats_summary";
          status?: "completed" | "failed" | "applied" | "dismissed";
          trigger?: "manual" | "cron";
          title?: string;
          summary?: string | null;
          output?: Json | null;
          subject_type?: string | null;
          subject_id?: string | null;
          model?: string | null;
          error?: string | null;
          created_by?: string | null;
          applied_by?: string | null;
          applied_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_tasks_applied_by_fkey";
            columns: ["applied_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_jobs: {
        Row: {
          id: string;
          worker: "report_review" | "content_plan" | "analytics";
          kind: string;
          trigger: "manual" | "cron" | "import";
          status: "queued" | "running" | "completed" | "failed" | "cancelled";
          provider: string;
          request: Json | null;
          input_range: Json | null;
          result_count: number;
          error: string | null;
          started_at: string | null;
          finished_at: string | null;
          admin_confirmed: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          worker: "report_review" | "content_plan" | "analytics";
          kind: string;
          trigger?: "manual" | "cron" | "import";
          status?: "queued" | "running" | "completed" | "failed" | "cancelled";
          provider?: string;
          request?: Json | null;
          input_range?: Json | null;
          result_count?: number;
          error?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          admin_confirmed?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          worker?: "report_review" | "content_plan" | "analytics";
          kind?: string;
          trigger?: "manual" | "cron" | "import";
          status?: "queued" | "running" | "completed" | "failed" | "cancelled";
          provider?: string;
          request?: Json | null;
          input_range?: Json | null;
          result_count?: number;
          error?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          admin_confirmed?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_jobs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_report_reviews: {
        Row: {
          id: string;
          job_id: string | null;
          source: "report" | "community_report";
          report_id: string;
          target_type: string | null;
          target_id: string | null;
          reason: string | null;
          report_count: number;
          recommended_action:
            | "dismiss"
            | "keep"
            | "hide"
            | "delete"
            | "reclassify_adult"
            | "change_category"
            | "warn_author"
            | "admin_review";
          rationale: string | null;
          risk_level: "low" | "medium" | "high";
          confidence: number;
          requires_human_review: boolean;
          suggested_category: string | null;
          status:
            | "pending_analysis"
            | "analyzed"
            | "admin_reviewing"
            | "resolved"
            | "held";
          admin_decision: string | null;
          admin_note: string | null;
          admin_id: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          source: "report" | "community_report";
          report_id: string;
          target_type?: string | null;
          target_id?: string | null;
          reason?: string | null;
          report_count?: number;
          recommended_action:
            | "dismiss"
            | "keep"
            | "hide"
            | "delete"
            | "reclassify_adult"
            | "change_category"
            | "warn_author"
            | "admin_review";
          rationale?: string | null;
          risk_level?: "low" | "medium" | "high";
          confidence?: number;
          requires_human_review?: boolean;
          suggested_category?: string | null;
          status?:
            | "pending_analysis"
            | "analyzed"
            | "admin_reviewing"
            | "resolved"
            | "held";
          admin_decision?: string | null;
          admin_note?: string | null;
          admin_id?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string | null;
          source?: "report" | "community_report";
          report_id?: string;
          target_type?: string | null;
          target_id?: string | null;
          reason?: string | null;
          report_count?: number;
          recommended_action?:
            | "dismiss"
            | "keep"
            | "hide"
            | "delete"
            | "reclassify_adult"
            | "change_category"
            | "warn_author"
            | "admin_review";
          rationale?: string | null;
          risk_level?: "low" | "medium" | "high";
          confidence?: number;
          requires_human_review?: boolean;
          suggested_category?: string | null;
          status?:
            | "pending_analysis"
            | "analyzed"
            | "admin_reviewing"
            | "resolved"
            | "held";
          admin_decision?: string | null;
          admin_note?: string | null;
          admin_id?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_report_reviews_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "ai_jobs";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_poll_drafts: {
        Row: {
          id: string;
          job_id: string | null;
          title: string;
          option_a: string;
          option_b: string;
          description: string | null;
          category: string;
          tags: string[];
          image_prompt_a: string | null;
          image_prompt_b: string | null;
          cover_image_prompt: string | null;
          image_path_a: string | null;
          image_path_b: string | null;
          cover_image_path: string | null;
          adult_only: boolean;
          featured: boolean;
          expected_audience: string | null;
          duplicate_risk: "low" | "medium" | "high";
          rationale: string | null;
          status: "pending" | "approved" | "published" | "rejected" | "archived";
          poll_id: string | null;
          content_hash: string | null;
          admin_id: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          title: string;
          option_a: string;
          option_b: string;
          description?: string | null;
          category?: string;
          tags?: string[];
          image_prompt_a?: string | null;
          image_prompt_b?: string | null;
          cover_image_prompt?: string | null;
          image_path_a?: string | null;
          image_path_b?: string | null;
          cover_image_path?: string | null;
          adult_only?: boolean;
          featured?: boolean;
          expected_audience?: string | null;
          duplicate_risk?: "low" | "medium" | "high";
          rationale?: string | null;
          status?: "pending" | "approved" | "published" | "rejected" | "archived";
          poll_id?: string | null;
          content_hash?: string | null;
          admin_id?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string | null;
          title?: string;
          option_a?: string;
          option_b?: string;
          description?: string | null;
          category?: string;
          tags?: string[];
          image_prompt_a?: string | null;
          image_prompt_b?: string | null;
          cover_image_prompt?: string | null;
          image_path_a?: string | null;
          image_path_b?: string | null;
          cover_image_path?: string | null;
          adult_only?: boolean;
          featured?: boolean;
          expected_audience?: string | null;
          duplicate_risk?: "low" | "medium" | "high";
          rationale?: string | null;
          status?: "pending" | "approved" | "published" | "rejected" | "archived";
          poll_id?: string | null;
          content_hash?: string | null;
          admin_id?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_poll_drafts_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "ai_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_poll_drafts_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_analytics_reports: {
        Row: {
          id: string;
          job_id: string | null;
          title: string;
          report_type: "manual" | "daily" | "weekly" | "monthly";
          period_start: string | null;
          period_end: string | null;
          metrics: Json;
          summary: string | null;
          details: string | null;
          highlights: Json;
          warnings: Json;
          recommendations: Json;
          data_scope: string | null;
          data_missing: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          title: string;
          report_type?: "manual" | "daily" | "weekly" | "monthly";
          period_start?: string | null;
          period_end?: string | null;
          metrics?: Json;
          summary?: string | null;
          details?: string | null;
          highlights?: Json;
          warnings?: Json;
          recommendations?: Json;
          data_scope?: string | null;
          data_missing?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string | null;
          title?: string;
          report_type?: "manual" | "daily" | "weekly" | "monthly";
          period_start?: string | null;
          period_end?: string | null;
          metrics?: Json;
          summary?: string | null;
          details?: string | null;
          highlights?: Json;
          warnings?: Json;
          recommendations?: Json;
          data_scope?: string | null;
          data_missing?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_analytics_reports_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "ai_jobs";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_poll_view: {
        Args: { p_poll_id: string };
        Returns: void;
      };
      increment_community_post_view: {
        Args: { p_post_id: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
