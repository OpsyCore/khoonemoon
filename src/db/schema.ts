import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const memberRoleEnum = pgEnum("member_role", ["OWNER", "MEMBER"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "CANCELED",
  "EXPIRED",
]);

export const taskVisibilityEnum = pgEnum("task_visibility", [
  "PRIVATE",
  "HOUSEHOLD_SHARED",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
  "ARCHIVED",
]);
export const taskPriorityEnum = pgEnum("task_priority", [
  "LOW",
  "NORMAL",
  "HIGH",
  "CRITICAL",
]);
export const taskRecurrenceFrequencyEnum = pgEnum("task_recurrence_frequency", [
  "NONE",
  "DAILY",
  "INTERVAL_DAYS",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);
export const choreRecurrenceFrequencyEnum = pgEnum(
  "chore_recurrence_frequency",
  [
    "NONE",
    "DAILY",
    "INTERVAL_DAYS",
    "WEEKLY",
    "MONTHLY",
    "YEARLY",
  ],
);

export const eventVisibilityEnum = pgEnum("event_visibility", [
  "PRIVATE",
  "HOUSEHOLD_SHARED",
]);
export const reminderTargetTypeEnum = pgEnum("reminder_target_type", [
  "TASK",
  "EVENT",
]);
export const reminderStatusEnum = pgEnum("reminder_status", [
  "PENDING",
  "SNOOZED",
  "SENT",
  "CANCELED",
]);
export const financeRecordTypeEnum = pgEnum("finance_record_type", [
  "EXPENSE",
  "BILL",
]);
export const financeVisibilityEnum = pgEnum("finance_visibility", [
  "PRIVATE",
  "HOUSEHOLD_SHARED",
]);
export const documentVisibilityEnum = pgEnum("document_visibility", [
  "PRIVATE",
  "HOUSEHOLD_SHARED",
]);
export const documentEntityTypeEnum = pgEnum("document_entity_type", [
  "TASK",
  "EVENT",
  "CHORE",
  "SHOPPING_LIST",
  "FINANCE_RECORD",
]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().notNull(),
    fullName: text("full_name").notNull().default(""),
    timezone: text("timezone").notNull().default("Asia/Tehran"),
    locale: text("locale").notNull().default("fa-IR"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [authUsers.id],
      name: "profiles_id_auth_users_fk",
    }).onDelete("cascade"),
  ],
);

export const households = pgTable(
  "households",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "households_created_by_auth_users_fk",
    }).onDelete("restrict"),
  ],
);

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: memberRoleEnum("role").notNull().default("MEMBER"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: "household_members_household_id_households_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "household_members_user_id_auth_users_fk",
    }).onDelete("cascade"),
    uniqueIndex("household_members_household_user_active_uniq")
      .on(table.householdId, table.userId)
      .where(sql`${table.leftAt} is null`),
    uniqueIndex("household_members_user_active_single_household_uniq")
      .on(table.userId)
      .where(sql`${table.leftAt} is null`),
    index("household_members_household_idx").on(table.householdId),
  ],
);

export const householdInvitations = pgTable(
  "household_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id").notNull(),
    invitedBy: uuid("invited_by").notNull(),
    inviteCodeHash: text("invite_code_hash").notNull(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedBy: uuid("accepted_by"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: "household_invitations_household_id_households_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.invitedBy],
      foreignColumns: [authUsers.id],
      name: "household_invitations_invited_by_auth_users_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.acceptedBy],
      foreignColumns: [authUsers.id],
      name: "household_invitations_accepted_by_auth_users_fk",
    }).onDelete("set null"),
    uniqueIndex("household_invitations_invite_code_hash_uniq").on(
      table.inviteCodeHash,
    ),
    index("household_invitations_household_status_idx").on(
      table.householdId,
      table.status,
    ),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    creatorId: uuid("creator_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    householdId: uuid("household_id"),
    visibility: taskVisibilityEnum("visibility").notNull().default("PRIVATE"),
    status: taskStatusEnum("status").notNull().default("PENDING"),
    priority: taskPriorityEnum("priority").notNull().default("NORMAL"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [authUsers.id],
      name: "tasks_creator_id_auth_users_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [authUsers.id],
      name: "tasks_owner_id_auth_users_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: "tasks_household_id_households_fk",
    }).onDelete("cascade"),
    index("tasks_owner_status_due_idx").on(
      table.ownerId,
      table.status,
      table.dueAt,
    ),
    index("tasks_household_visibility_due_idx").on(
      table.householdId,
      table.visibility,
      table.dueAt,
    ),
  ],
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull(),
    assigneeId: uuid("assignee_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: "task_assignees_task_id_tasks_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.assigneeId],
      foreignColumns: [authUsers.id],
      name: "task_assignees_assignee_id_auth_users_fk",
    }).onDelete("cascade"),
    uniqueIndex("task_assignees_task_assignee_uniq").on(
      table.taskId,
      table.assigneeId,
    ),
    index("task_assignees_assignee_idx").on(table.assigneeId),
  ],
);

export const taskRecurrences = pgTable(
  "task_recurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull(),
    frequency: taskRecurrenceFrequencyEnum("frequency")
      .notNull()
      .default("NONE"),
    intervalDays: integer("interval_days"),
    weekdays: integer("weekdays").array(),
    nextOccurrenceAt: timestamp("next_occurrence_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: "task_recurrences_task_id_tasks_fk",
    }).onDelete("cascade"),
    uniqueIndex("task_recurrences_task_uniq").on(table.taskId),
  ],
);

export const chores = pgTable(
  "chores",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    householdId: uuid("household_id").notNull(),

    createdBy: uuid("created_by").notNull(),

    defaultAssigneeId: uuid("default_assignee_id"),

    title: text("title").notNull(),

    description: text("description"),

    isActive: boolean("is_active")
      .notNull()
      .default(true),

    startDate: date("start_date")
      .notNull()
      .default(sql`current_date`),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: "chores_household_id_households_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "chores_created_by_auth_users_fk",
    }).onDelete("restrict"),

    foreignKey({
      columns: [table.defaultAssigneeId],
      foreignColumns: [authUsers.id],
      name: "chores_default_assignee_id_auth_users_fk",
    }).onDelete("set null"),

    index("chores_household_active_idx").on(
      table.householdId,
      table.isActive,
    ),

    index("chores_default_assignee_idx").on(
      table.defaultAssigneeId,
    ),
  ],
);

export const choreRecurrences = pgTable(
  "chore_recurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    choreId: uuid("chore_id").notNull(),

    frequency: choreRecurrenceFrequencyEnum("frequency")
      .notNull()
      .default("NONE"),

    intervalDays: integer("interval_days"),

    weekdays: integer("weekdays").array(),

    nextOccurrenceDate: date("next_occurrence_date"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.choreId],
      foreignColumns: [chores.id],
      name: "chore_recurrences_chore_id_chores_fk",
    }).onDelete("cascade"),

    uniqueIndex("chore_recurrences_chore_uniq").on(
      table.choreId,
    ),
  ],
);

export const choreRotations = pgTable(
  "chore_rotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    choreId: uuid("chore_id").notNull(),

    userId: uuid("user_id").notNull(),

    position: integer("position").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.choreId],
      foreignColumns: [chores.id],
      name: "chore_rotations_chore_id_chores_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "chore_rotations_user_id_auth_users_fk",
    }).onDelete("cascade"),

    uniqueIndex("chore_rotations_chore_user_uniq").on(
      table.choreId,
      table.userId,
    ),

    uniqueIndex("chore_rotations_chore_position_uniq").on(
      table.choreId,
      table.position,
    ),

    index("chore_rotations_chore_position_idx").on(
      table.choreId,
      table.position,
    ),

    index("chore_rotations_user_idx").on(
      table.userId,
    ),
  ],
);

export const choreCompletions = pgTable(
  "chore_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    choreId: uuid("chore_id").notNull(),

    forDate: date("for_date").notNull(),

    assignedTo: uuid("assigned_to"),

    completedBy: uuid("completed_by").notNull(),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.choreId],
      foreignColumns: [chores.id],
      name: "chore_completions_chore_id_chores_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.assignedTo],
      foreignColumns: [authUsers.id],
      name: "chore_completions_assigned_to_auth_users_fk",
    }).onDelete("set null"),

    foreignKey({
      columns: [table.completedBy],
      foreignColumns: [authUsers.id],
      name: "chore_completions_completed_by_auth_users_fk",
    }).onDelete("restrict"),

    uniqueIndex("chore_completions_chore_date_uniq").on(
      table.choreId,
      table.forDate,
    ),

    index("chore_completions_chore_date_idx").on(
      table.choreId,
      table.forDate,
    ),

    index("chore_completions_assigned_to_date_idx").on(
      table.assignedTo,
      table.forDate,
    ),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    creatorId: uuid("creator_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    householdId: uuid("household_id"),
    visibility: eventVisibilityEnum("visibility").notNull().default("PRIVATE"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    location: text("location"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [authUsers.id],
      name: "events_creator_id_auth_users_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [authUsers.id],
      name: "events_owner_id_auth_users_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: "events_household_id_households_fk",
    }).onDelete("cascade"),
    index("events_household_start_idx").on(table.householdId, table.startAt),
    index("events_owner_start_idx").on(table.ownerId, table.startAt),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: reminderTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    userId: uuid("user_id").notNull(),
    householdId: uuid("household_id"),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    status: reminderStatusEnum("status").notNull().default("PENDING"),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    snoozeCount: integer("snooze_count").notNull().default(0),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "reminders_user_id_auth_users_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: "reminders_household_id_households_fk",
    }).onDelete("cascade"),
    index("reminders_user_status_remind_idx").on(
      table.userId,
      table.status,
      table.remindAt,
    ),
    index("reminders_target_idx").on(table.targetType, table.targetId),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    webPushEnabled: boolean("web_push_enabled").notNull().default(false),
    quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
    quietHoursStart: text("quiet_hours_start"),
    quietHoursEnd: text("quiet_hours_end"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [authUsers.id],
      name: "notification_preferences_user_id_auth_users_fk",
    }).onDelete("cascade"),
    uniqueIndex("notification_preferences_user_uniq").on(table.userId),
  ],
);

export const financeRecords = pgTable(
  "finance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordType: financeRecordTypeEnum("record_type").notNull(),
    title: text("title").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("IRR"),
    ownerId: uuid("owner_id").notNull(),
    createdBy: uuid("created_by").notNull(),
    householdId: uuid("household_id"),
    visibility: financeVisibilityEnum("visibility")
      .notNull()
      .default("PRIVATE"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidBy: uuid("paid_by"),
    category: text("category"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [authUsers.id],
      name: "finance_records_owner_id_auth_users_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "finance_records_created_by_auth_users_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: "finance_records_household_id_households_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.paidBy],
      foreignColumns: [authUsers.id],
      name: "finance_records_paid_by_auth_users_fk",
    }).onDelete("set null"),
    index("finance_records_owner_type_due_idx").on(
      table.ownerId,
      table.recordType,
      table.dueAt,
    ),
    index("finance_records_household_visibility_due_idx").on(
      table.householdId,
      table.visibility,
      table.dueAt,
    ),
    index("finance_records_unpaid_bills_due_idx")
      .on(table.dueAt)
      .where(sql`${table.recordType} = 'BILL' and ${table.paidAt} is null`),
    index("finance_records_paid_by_idx")
      .on(table.paidBy)
      .where(sql`${table.paidBy} is not null`),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id"),
    createdBy: uuid("created_by").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    storagePath: text("storage_path").notNull(),
    visibility: documentVisibilityEnum("visibility")
      .notNull()
      .default("PRIVATE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.householdId],
      foreignColumns: [households.id],
      name: "documents_household_id_households_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "documents_created_by_auth_users_fk",
    }).onDelete("restrict"),
    uniqueIndex("documents_storage_path_unique").on(table.storagePath),
    index("documents_created_by_created_idx").on(
      table.createdBy,
      table.createdAt,
    ),
    index("documents_household_visibility_idx").on(
      table.householdId,
      table.visibility,
      table.createdAt,
    ),
  ],
);

export const documentAttachments = pgTable(
  "document_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull(),
    entityType: documentEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [documents.id],
      name: "document_attachments_document_id_documents_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [authUsers.id],
      name: "document_attachments_created_by_auth_users_fk",
    }).onDelete("restrict"),
    uniqueIndex("document_attachments_unique_link").on(
      table.documentId,
      table.entityType,
      table.entityId,
    ),
    index("document_attachments_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
  ],
);

export const updateTimestampSql = sql`
  create or replace function public.set_current_timestamp_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;
`;
