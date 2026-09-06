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
        { date: string; gih_count: number | null; breakfast_count: number | null },
        { date: string; gih_count?: number | null; breakfast_count?: number | null }
      >;
      daily_events: Table<
        { id: number; date: string; room: string | null; title: string; details: string | null },
        { id?: number; date: string; room?: string | null; title: string; details?: string | null }
      >;
      checklists: Table<
        { id: number; title: string; sort_order: number },
        { id?: number; title: string; sort_order?: number }
      >;
      checklist_items: Table<
        { id: number; checklist_id: number; text: string; sort_order: number },
        { id?: number; checklist_id: number; text: string; sort_order?: number }
      >;
      checklist_completions: Table<
        {
          id: number;
          item_id: number;
          checklist_day: string;
          completed_by: string | null;
          completed_at: string;
        },
        {
          id?: number;
          item_id: number;
          checklist_day: string;
          completed_by?: string | null;
          completed_at?: string;
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
        },
        {
          id?: number;
          author_id?: string | null;
          text?: string | null;
          photo_url?: string | null;
          file_url?: string | null;
          file_name?: string | null;
          created_at?: string;
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
          sort_order: number;
        },
        {
          id?: number;
          category: string;
          title: string;
          steps: string[];
          photo_url?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
