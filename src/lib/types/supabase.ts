export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Array<Json>

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4'
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          reason: string
          stripe_event_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          reason: string
          stripe_event_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          reason?: string
          stripe_event_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fal_price_cache: {
        Row: {
          currency: string
          endpoint_id: string
          fetched_at: string
          unit: string
          unit_price: number
        }
        Insert: {
          currency?: string
          endpoint_id: string
          fetched_at?: string
          unit: string
          unit_price: number
        }
        Update: {
          currency?: string
          endpoint_id?: string
          fetched_at?: string
          unit?: string
          unit_price?: number
        }
        Relationships: []
      }
      multishot_sequences: {
        Row: {
          created_at: string | null
          elements: Json
          estimated_cost: number | null
          id: string
          name: string
          settings: Json
          shots: Json
          status: string
          updated_at: string | null
          user_id: string
          video_record_id: string | null
        }
        Insert: {
          created_at?: string | null
          elements?: Json
          estimated_cost?: number | null
          id?: string
          name?: string
          settings?: Json
          shots?: Json
          status?: string
          updated_at?: string | null
          user_id: string
          video_record_id?: string | null
        }
        Update: {
          created_at?: string | null
          elements?: Json
          estimated_cost?: number | null
          id?: string
          name?: string
          settings?: Json
          shots?: Json
          status?: string
          updated_at?: string | null
          user_id?: string
          video_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'multishot_sequences_video_record_id_fkey'
            columns: ['video_record_id']
            isOneToOne: false
            referencedRelation: 'user_images'
            referencedColumns: ['id']
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_studio_sets: {
        Row: {
          created_at: string
          id: string
          name: string
          negative_prompt: string
          prompt: string
          selected_model_ids: Array<string> | null
          system_prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          negative_prompt?: string
          prompt?: string
          selected_model_ids?: Array<string> | null
          system_prompt?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          negative_prompt?: string
          prompt?: string
          selected_model_ids?: Array<string> | null
          system_prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storyboards: {
        Row: {
          characters: Json
          created_at: string
          id: string
          refined_story: string | null
          scenes: Json
          status: string
          story_prompt: string
          title: string
          updated_at: string
          user_id: string
          video_record_id: string | null
        }
        Insert: {
          characters?: Json
          created_at?: string
          id?: string
          refined_story?: string | null
          scenes?: Json
          status?: string
          story_prompt: string
          title?: string
          updated_at?: string
          user_id: string
          video_record_id?: string | null
        }
        Update: {
          characters?: Json
          created_at?: string
          id?: string
          refined_story?: string | null
          scenes?: Json
          status?: string
          story_prompt?: string
          title?: string
          updated_at?: string
          user_id?: string
          video_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'storyboards_video_record_id_fkey'
            columns: ['video_record_id']
            isOneToOne: false
            referencedRelation: 'user_images'
            referencedColumns: ['id']
          },
        ]
      }
      style_collections: {
        Row: {
          created_at: string | null
          id: string
          image_count: number | null
          name: string
          thumbnail_path: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_count?: number | null
          name: string
          thumbnail_path?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_count?: number | null
          name?: string
          thumbnail_path?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      style_images: {
        Row: {
          created_at: string | null
          height: number | null
          id: string
          sort_order: number | null
          source: string
          storage_path: string
          style_id: string
          width: number | null
        }
        Insert: {
          created_at?: string | null
          height?: number | null
          id?: string
          sort_order?: number | null
          source: string
          storage_path: string
          style_id: string
          width?: number | null
        }
        Update: {
          created_at?: string | null
          height?: number | null
          id?: string
          sort_order?: number | null
          source?: string
          storage_path?: string
          style_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'style_images_style_id_fkey'
            columns: ['style_id']
            isOneToOne: false
            referencedRelation: 'style_collections'
            referencedColumns: ['id']
          },
        ]
      }
      user_images: {
        Row: {
          color_palette: Json | null
          created_at: string
          deleted_at: string | null
          description: string | null
          file_hash: string | null
          file_name: string | null
          file_size: number | null
          generation_error: string | null
          generation_metadata: Json | null
          height: number | null
          hidden: boolean
          id: string
          idempotency_key: string | null
          mime_type: string | null
          on_canvas: boolean
          request_id: string | null
          sort_order: number | null
          source: string
          status: string
          storage_path: string | null
          thumbnail_path: string | null
          title: string
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          color_palette?: Json | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          generation_error?: string | null
          generation_metadata?: Json | null
          height?: number | null
          hidden?: boolean
          id?: string
          idempotency_key?: string | null
          mime_type?: string | null
          on_canvas?: boolean
          request_id?: string | null
          sort_order?: number | null
          source?: string
          status?: string
          storage_path?: string | null
          thumbnail_path?: string | null
          title: string
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          color_palette?: Json | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          generation_error?: string | null
          generation_metadata?: Json | null
          height?: number | null
          hidden?: boolean
          id?: string
          idempotency_key?: string | null
          mime_type?: string | null
          on_canvas?: boolean
          request_id?: string | null
          sort_order?: number | null
          source?: string
          status?: string
          storage_path?: string | null
          thumbnail_path?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          account_status: Database['public']['Enums']['account_status']
          created_at: string
          credit_balance: number
          display_name: string | null
          id: string
          rate_window_count: number
          rate_window_start: string
          stripe_customer_id: string | null
        }
        Insert: {
          account_status?: Database['public']['Enums']['account_status']
          created_at?: string
          credit_balance?: number
          display_name?: string | null
          id: string
          rate_window_count?: number
          rate_window_start?: string
          stripe_customer_id?: string | null
        }
        Update: {
          account_status?: Database['public']['Enums']['account_status']
          created_at?: string
          credit_balance?: number
          display_name?: string | null
          id?: string
          rate_window_count?: number
          rate_window_start?: string
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      user_prompts: {
        Row: {
          content: string
          created_at: string
          default_key: string | null
          id: string
          is_default: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          default_key?: string | null
          id?: string
          is_default?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          default_key?: string | null
          id?: string
          is_default?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_generations: {
        Row: {
          created_at: string | null
          first_frame_id: string | null
          id: string
          last_frame_id: string | null
          user_id: string
          video_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          first_frame_id?: string | null
          id?: string
          last_frame_id?: string | null
          user_id: string
          video_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          first_frame_id?: string | null
          id?: string
          last_frame_id?: string | null
          user_id?: string
          video_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'video_generations_first_frame_id_fkey'
            columns: ['first_frame_id']
            isOneToOne: false
            referencedRelation: 'user_images'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'video_generations_last_frame_id_fkey'
            columns: ['last_frame_id']
            isOneToOne: false
            referencedRelation: 'user_images'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'video_generations_video_id_fkey'
            columns: ['video_id']
            isOneToOne: false
            referencedRelation: 'user_images'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'video_generations_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'video_workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      video_workspaces: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits:
        | {
            Args: { p_amount: number; p_reason: string; p_user_id: string }
            Returns: number
          }
        | {
            Args: {
              p_amount: number
              p_reason: string
              p_stripe_event_id?: string
              p_user_id: string
            }
            Returns: number
          }
      check_rate_limit: {
        Args: {
          p_max_requests: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_stale_generations: { Args: never; Returns: undefined }
      deduct_credits: {
        Args: { p_amount: number; p_reason: string; p_user_id: string }
        Returns: Array<{
          new_balance: number
          success: boolean
        }>
      }
      get_credit_balance: { Args: { p_user_id: string }; Returns: number }
      get_duplicate_images: {
        Args: { p_user_id: string }
        Returns: Array<{
          file_hash: string
          image_count: number
          image_ids: Array<string>
          total_size: number
        }>
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { '': string }; Returns: Array<string> }
    }
    Enums: {
      account_status: 'waitlist' | 'active'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ['waitlist', 'active'],
    },
  },
} as const
