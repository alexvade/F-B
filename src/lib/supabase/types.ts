// Hand-written to match supabase/migrations/0001_init.sql. Once a real
// Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
// and re-check this file still lines up with the app code below.
//
// `Relationships: []` on every table (and `Views`/`Functions`/`Enums`/
// `CompositeTypes` on the schema) aren't decorative — @supabase/postgrest-js's
// GenericTable/GenericSchema constraints require them, and if they're
// missing every query on this Database type silently resolves to `never`
// instead of erroring, which is a nasty one to debug.

import type { EventContent } from "../event-content";
import type { MenuContent } from "../menu-content";

export type Role = "admin" | "staff";
export type ShiftStatus = "work" | "off" | "holiday";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          name: string;
          email: string | null;
          role: Role;
          avatar_url: string | null;
          contract_hours: number | null;
          created_at: string;
        },
        {
          id: string;
          name: string;
          email?: string | null;
          role?: Role;
          avatar_url?: string | null;
          contract_hours?: number | null;
          created_at?: string;
        }
      >;
      // Read-only view — returns `email` only for a viewer's own row or for
      // admins (see 0019_profiles_email_privacy.sql), null for everyone
      // else's. Use this instead of `profiles` wherever email is needed;
      // `profiles` itself no longer grants column-level access to it.
      profiles_directory: Table<
        {
          id: string;
          name: string;
          email: string | null;
          role: Role;
          avatar_url: string | null;
          contract_hours: number | null;
          created_at: string;
        },
        {
          id: string;
          name: string;
          email?: string | null;
          role?: Role;
          avatar_url?: string | null;
          contract_hours?: number | null;
          created_at?: string;
        }
      >;
      rota_shifts: Table<
        {
          id: number;
          staff_id: string | null;
          staff_name: string;
          date: string;
          status: ShiftStatus;
          start_time: string | null;
          end_time: string | null;
        },
        {
          id?: number;
          staff_id?: string | null;
          staff_name: string;
          date: string;
          status: ShiftStatus;
          start_time?: string | null;
          end_time?: string | null;
        }
      >;
      daily_covers: Table<
        {
          date: string;
          gih_count: number | null;
          breakfast_count: number | null;
          rooms_in_house: number | null;
          arrival_rooms: number | null;
          departure_rooms: number | null;
          afternoon_tea: number | null;
          dinner_covers: number | null;
          confirmed_events: number | null;
          non_resident_dinners: number | null;
          floaters: number | null;
        },
        {
          date: string;
          gih_count?: number | null;
          breakfast_count?: number | null;
          rooms_in_house?: number | null;
          arrival_rooms?: number | null;
          departure_rooms?: number | null;
          afternoon_tea?: number | null;
          dinner_covers?: number | null;
          confirmed_events?: number | null;
          non_resident_dinners?: number | null;
          floaters?: number | null;
        }
      >;
      rota_staff_order: Table<
        { staff_name: string; sort_order: number },
        { staff_name: string; sort_order: number }
      >;
      daily_events: Table<
        { id: number; date: string; room: string | null; title: string; details: string | null },
        { id?: number; date: string; room?: string | null; title: string; details?: string | null }
      >;
      checklists: Table<
        { id: number; title: string; section: string; sort_order: number; weekly: boolean; table_view: boolean },
        {
          id?: number;
          title: string;
          section?: string;
          sort_order?: number;
          weekly?: boolean;
          table_view?: boolean;
        }
      >;
      checklist_items: Table<
        { id: number; checklist_id: number; text: string; sort_order: number; requires_value: boolean },
        { id?: number; checklist_id: number; text: string; sort_order?: number; requires_value?: boolean }
      >;
      checklist_completions: Table<
        {
          id: number;
          item_id: number;
          checklist_day: string;
          completed_by: string | null;
          completed_at: string;
          value: string | null;
        },
        {
          id?: number;
          item_id: number;
          checklist_day: string;
          completed_by?: string | null;
          completed_at?: string;
          value?: string | null;
        }
      >;
      running_orders: Table<
        {
          id: number;
          title: string;
          event_date: string | null;
          sort_order: number;
          created_by: string | null;
          created_at: string;
        },
        {
          id?: number;
          title: string;
          event_date?: string | null;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
        }
      >;
      running_order_items: Table<
        { id: number; running_order_id: number; text: string; sort_order: number },
        { id?: number; running_order_id: number; text: string; sort_order?: number }
      >;
      running_order_completions: Table<
        {
          id: number;
          item_id: number;
          completed_by: string | null;
          completed_at: string;
        },
        {
          id?: number;
          item_id: number;
          completed_by?: string | null;
          completed_at?: string;
        }
      >;
      running_order_comments: Table<
        {
          id: number;
          item_id: number;
          author_id: string | null;
          text: string | null;
          photo_url: string | null;
          created_at: string;
        },
        {
          id?: number;
          item_id: number;
          author_id?: string | null;
          text?: string | null;
          photo_url?: string | null;
          created_at?: string;
        }
      >;
      todos: Table<
        {
          id: number;
          text: string;
          added_by: string | null;
          checklist_day: string;
          done: boolean;
          completed_by: string | null;
          created_at: string;
        },
        {
          id?: number;
          text: string;
          added_by?: string | null;
          checklist_day: string;
          done?: boolean;
          completed_by?: string | null;
          created_at?: string;
        }
      >;
      posts: Table<
        {
          id: number;
          author_id: string | null;
          text: string | null;
          photo_url: string | null;
          file_url: string | null;
          file_name: string | null;
          created_at: string;
          poll_options: string[] | null;
          pinned: boolean;
        },
        {
          id?: number;
          author_id?: string | null;
          text?: string | null;
          photo_url?: string | null;
          file_url?: string | null;
          file_name?: string | null;
          created_at?: string;
          poll_options?: string[] | null;
          pinned?: boolean;
        }
      >;
      poll_votes: Table<
        {
          id: number;
          post_id: number;
          voter_id: string;
          option_index: number;
          created_at: string;
        },
        {
          id?: number;
          post_id: number;
          voter_id: string;
          option_index: number;
          created_at?: string;
        }
      >;
      event_line_overrides: Table<
        {
          id: number;
          event_id: number;
          day_date: string;
          item_index: number;
          field: string;
          previous_value: string;
          new_value: string;
          changed_by: string | null;
          changed_at: string;
        },
        {
          id?: number;
          event_id: number;
          day_date: string;
          item_index: number;
          field: string;
          previous_value: string;
          new_value: string;
          changed_by?: string | null;
          changed_at?: string;
        }
      >;
      training_uploads: Table<
        {
          id: number;
          uploaded_by: string | null;
          uploaded_at: string;
          row_count: number;
        },
        {
          id?: number;
          uploaded_by?: string | null;
          uploaded_at?: string;
          row_count: number;
        }
      >;
      training_records: Table<
        {
          id: number;
          learner_name: string;
          identifier: string | null;
          email: string | null;
          employment_start_date: string | null;
          compliance_item_name: string;
          compliance_item_type: string | null;
          status: string;
          due_date: string | null;
          allocation_date: string | null;
          allocated_by: string | null;
          collection_name: string | null;
          department: string | null;
          completed_date: string | null;
          job_title: string | null;
          uploaded_at: string;
        },
        {
          id?: number;
          learner_name: string;
          identifier?: string | null;
          email?: string | null;
          employment_start_date?: string | null;
          compliance_item_name: string;
          compliance_item_type?: string | null;
          status: string;
          due_date?: string | null;
          allocation_date?: string | null;
          allocated_by?: string | null;
          collection_name?: string | null;
          department?: string | null;
          completed_date?: string | null;
          job_title?: string | null;
          uploaded_at?: string;
        }
      >;
      // Read-only view — returns `email` only for admins (see
      // 0027_training_visibility.sql), null for everyone else. Use this
      // instead of `training_records` wherever staff (not just admins)
      // need to read the data; `training_records` itself stays admin-only.
      training_directory: Table<
        {
          id: number;
          learner_name: string;
          identifier: string | null;
          email: string | null;
          employment_start_date: string | null;
          compliance_item_name: string;
          compliance_item_type: string | null;
          status: string;
          due_date: string | null;
          allocation_date: string | null;
          allocated_by: string | null;
          collection_name: string | null;
          department: string | null;
          completed_date: string | null;
          job_title: string | null;
          uploaded_at: string;
        },
        {
          id?: number;
          learner_name: string;
          identifier?: string | null;
          email?: string | null;
          employment_start_date?: string | null;
          compliance_item_name: string;
          compliance_item_type?: string | null;
          status: string;
          due_date?: string | null;
          allocation_date?: string | null;
          allocated_by?: string | null;
          collection_name?: string | null;
          department?: string | null;
          completed_date?: string | null;
          job_title?: string | null;
          uploaded_at?: string;
        }
      >;
      comments: Table<
        {
          id: number;
          post_id: number;
          author_id: string | null;
          text: string | null;
          photo_url: string | null;
          file_url: string | null;
          file_name: string | null;
          created_at: string;
        },
        {
          id?: number;
          post_id: number;
          author_id?: string | null;
          text?: string | null;
          photo_url?: string | null;
          file_url?: string | null;
          file_name?: string | null;
          created_at?: string;
        }
      >;
      sops: Table<
        {
          id: number;
          category: string;
          title: string;
          steps: string[];
          photo_url: string | null;
          video_url: string | null;
          sort_order: number;
        },
        {
          id?: number;
          category: string;
          title: string;
          steps: string[];
          photo_url?: string | null;
          video_url?: string | null;
          sort_order?: number;
        }
      >;
      nominations: Table<
        { id: number; nominee_name: string; reason: string; nominated_by: string | null; created_at: string },
        {
          id?: number;
          nominee_name: string;
          reason: string;
          nominated_by?: string | null;
          created_at?: string;
        }
      >;
      nomination_votes: Table<
        { nomination_id: number; user_id: string },
        { nomination_id: number; user_id: string }
      >;
      cocktails: Table<
        {
          id: number;
          name: string;
          category: string;
          glass_shape: string | null;
          colour: string | null;
          garnish: string | null;
          ingredients: string[];
          method: string[];
          sort_order: number;
          pinned: boolean;
        },
        {
          id?: number;
          name: string;
          category: string;
          glass_shape?: string | null;
          colour?: string | null;
          garnish?: string | null;
          ingredients?: string[];
          method?: string[];
          sort_order?: number;
          pinned?: boolean;
        }
      >;
      wines: Table<
        {
          id: number;
          section: string;
          name: string;
          region: string | null;
          vintage: string | null;
          price: string | null;
          glass_note: string | null;
          tasting_note: string | null;
          sort_order: number;
          delisted: boolean;
        },
        {
          id?: number;
          section: string;
          name: string;
          region?: string | null;
          vintage?: string | null;
          price?: string | null;
          glass_note?: string | null;
          tasting_note?: string | null;
          sort_order?: number;
          delisted?: boolean;
        }
      >;
      function_sheets: Table<
        {
          id: number;
          title: string;
          file_url: string;
          file_name: string | null;
          uploaded_by: string | null;
          uploaded_at: string;
        },
        {
          id?: number;
          title: string;
          file_url: string;
          file_name?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
        }
      >;
      stock_products: Table<
        {
          id: number;
          tab_gid: string;
          tab_label: string;
          category: string;
          row_number: number;
          order_col_letter: string;
          code: string | null;
          product: string;
          cellar_code: string | null;
          supplier: string | null;
          sort_order: number;
          quantity: number | null;
          updated_by: string | null;
          updated_at: string | null;
          delisted: boolean;
        },
        {
          id?: number;
          tab_gid: string;
          tab_label: string;
          category: string;
          row_number: number;
          order_col_letter: string;
          code?: string | null;
          product: string;
          cellar_code?: string | null;
          supplier?: string | null;
          sort_order: number;
          quantity?: number | null;
          updated_by?: string | null;
          updated_at?: string | null;
          delisted?: boolean;
        }
      >;
      stock_tab_order: Table<
        { tab_label: string; sort_order: number },
        { tab_label: string; sort_order: number }
      >;
      events: Table<
        {
          id: number;
          title: string;
          function_sheet_id: number | null;
          event_date: string | null;
          content: EventContent | null;
          created_by: string | null;
          created_at: string;
          updated_at: string | null;
        },
        {
          id?: number;
          title: string;
          function_sheet_id?: number | null;
          event_date?: string | null;
          content?: EventContent | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        }
      >;
      birthdays: Table<
        { id: number; name: string; day: number; month: number; created_at: string },
        { id?: number; name: string; day: number; month: number; created_at?: string }
      >;
      feature_flags: Table<
        { key: string; enabled: boolean; updated_by: string | null; updated_at: string | null },
        { key: string; enabled?: boolean; updated_by?: string | null; updated_at?: string | null }
      >;
      menus: Table<
        {
          slug: string;
          title: string;
          content: MenuContent | null;
          updated_by: string | null;
          updated_at: string | null;
        },
        {
          slug: string;
          title: string;
          content?: MenuContent | null;
          updated_by?: string | null;
          updated_at?: string | null;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
