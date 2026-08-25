"use client"

import type { ReactNode } from "react"

import { DetailList } from "@/components/shared/detail-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApprovalStepper } from "@/components/workflow/approval-stepper"
import { EmailTracker } from "@/components/workflow/email-tracker"
import type { EmailNotificationData, WorkflowStepData } from "@/lib/types"

export function ContextPanel({
  steps,
  emails,
  details,
  activeTab,
  onTabChange,
}: {
  steps?: WorkflowStepData[]
  emails?: EmailNotificationData[]
  details?: [string, ReactNode][]
  activeTab: string
  onTabChange: (value: string) => void
}) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-3 rounded-none border-b border-border bg-muted/40 px-3 py-0"
        >
          {steps && (
            <TabsTrigger value="workflow" className="px-0 py-2.5">
              Workflow
            </TabsTrigger>
          )}
          {emails && (
            <TabsTrigger value="emails" className="px-0 py-2.5">
              Emails
            </TabsTrigger>
          )}
          {details && (
            <TabsTrigger value="detail" className="px-0 py-2.5">
              Detail
            </TabsTrigger>
          )}
        </TabsList>
        {steps && (
          <TabsContent value="workflow">
            <ApprovalStepper steps={steps} />
          </TabsContent>
        )}
        {emails && (
          <TabsContent value="emails">
            <EmailTracker items={emails} />
          </TabsContent>
        )}
        {details && (
          <TabsContent value="detail" className="p-3">
            <DetailList rows={details} />
          </TabsContent>
        )}
      </Tabs>
    </aside>
  )
}
