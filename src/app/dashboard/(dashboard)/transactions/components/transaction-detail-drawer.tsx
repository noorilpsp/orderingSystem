"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useDisplayPhone } from "@/lib/public-menu/use-display-phone"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  X,
  CreditCard,
  Copy,
  Download,
  Mail,
  Printer,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Tag,
  MessageSquare,
  Eye,
  RotateCcw,
} from "lucide-react"
import type { TransactionDetail } from "../types/detail-types"
import { getStatusBadge, getTransactionIcon } from "../utils"
import { format, formatDistanceToNow } from "date-fns"
import { RefundModal } from "./refund-modal"
import { DisputeAlertBanner } from "./dispute-alert-banner"
import { ManageDisputeModal } from "./manage-dispute-modal"
import { getDisputeForTransaction } from "../data/dispute-data"

interface TransactionDetailDrawerProps {
  transaction: TransactionDetail | null
  open: boolean
  onClose: () => void
}

export function TransactionDetailDrawer({ transaction, open, onClose }: TransactionDetailDrawerProps) {
  const displayPhone = useDisplayPhone()
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false)
  const [showRawResponse, setShowRawResponse] = useState(false)
  const [showAllTimeline, setShowAllTimeline] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [disputeModalOpen, setDisputeModalOpen] = useState(false)

  if (!transaction) return null

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getTimelineIcon = (status?: string) => {
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-success" />
    if (status === "pending") return <Clock className="h-4 w-4 text-warning" />
    if (status === "failed") return <AlertCircle className="h-4 w-4 text-destructive" />
    return <div className="h-4 w-4 rounded-full bg-muted" />
  }

  const refundableAmount = transaction.amount - transaction.refunds.reduce((sum, r) => sum + r.amount, 0)

  const handleRefundClick = () => {
    setRefundModalOpen(true)
  }

  const dispute = getDisputeForTransaction(transaction.transactionId)

  const handleManageDispute = () => {
    setDisputeModalOpen(true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0">
          <ScrollArea className="h-full">
            <div className="flex flex-col">
              {/* Header */}
              <SheetHeader className="sticky top-0 z-10 border-b bg-background p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <SheetTitle className="text-lg font-semibold">Transaction {transaction.transactionId}</SheetTitle>
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(transaction.type)}
                      <span className="capitalize">{transaction.type}</span>
                      <span>•</span>
                      {getStatusBadge(transaction.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(transaction.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                      <span className="ml-2">
                        ({formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })})
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  {transaction.status === "succeeded" && refundableAmount > 0 && (
                    <Button size="sm" variant="outline" onClick={handleRefundClick}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Refund
                    </Button>
                  )}
                  {dispute && (
                    <Button size="sm" variant="outline" onClick={handleManageDispute}>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Manage Dispute
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button size="sm" variant="outline">
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(transaction.transactionId)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy ID
                  </Button>
                </div>
              </SheetHeader>

              <div className="p-6 space-y-6">
                {dispute && (
                  <DisputeAlertBanner
                    dispute={dispute}
                    onManageDispute={handleManageDispute}
                    onViewEvidence={() => {
                      setDisputeModalOpen(true)
                    }}
                    onAddEvidence={() => {
                      setDisputeModalOpen(true)
                    }}
                    variant="transaction"
                  />
                )}

                {/* Failed Transaction Alert */}
                {transaction.status === "failed" && (
                  <Card className="border-destructive bg-destructive/5">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <CardTitle className="text-base">Payment Failed</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">This transaction could not be completed.</p>
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="font-medium">Error:</span> card_declined
                        </div>
                        <div>
                          <span className="font-medium">Reason:</span> Insufficient funds
                        </div>
                        <div className="text-muted-foreground">
                          "The card has insufficient funds to complete the purchase."
                        </div>
                      </div>
                      <Button size="sm" className="w-full">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry Payment
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Payment Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {transaction.status === "partially_refunded" ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Original Amount:</span>
                          <span className="font-medium">
                            €
                            {(transaction.amount + transaction.refunds.reduce((sum, r) => sum + r.amount, 0)).toFixed(
                              2,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Refunded:</span>
                          <span className="font-medium text-destructive">
                            -€{transaction.refunds.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Current Amount:</span>
                          <span className="font-medium">€{transaction.amount.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gross Amount:</span>
                        <span className="text-xl font-semibold">€{transaction.amount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-muted-foreground"
                        onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}
                      >
                        Processing Fee:
                        <ChevronDown
                          className={`ml-1 h-4 w-4 transition-transform ${showFeeBreakdown ? "rotate-180" : ""}`}
                        />
                      </Button>
                      <span className="font-medium">-€{transaction.fees.toFixed(2)}</span>
                    </div>

                    {showFeeBreakdown && (
                      <Card className="bg-muted/50">
                        <CardContent className="p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Base rate ({transaction.feeBreakdown.baseRatePercentage}%):</span>
                            <span>€{transaction.feeBreakdown.baseRate.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Fixed fee:</span>
                            <span>€{transaction.feeBreakdown.fixedFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Effective rate:</span>
                            <span>{transaction.feeBreakdown.effectiveRate}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Separator />

                    <div className="flex justify-between">
                      <span className="font-medium">Net Amount:</span>
                      <span className="text-xl font-semibold">€{transaction.net.toFixed(2)}</span>
                    </div>

                    {refundableAmount > 0 && transaction.status !== "failed" && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>Refundable balance: €{refundableAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="font-medium">Payment Method:</div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span className="capitalize">
                          {transaction.paymentMethod.brand || transaction.paymentMethod.type}
                        </span>
                        {transaction.paymentMethod.last4 && <span>ending in {transaction.paymentMethod.last4}</span>}
                      </div>
                      {transaction.paymentMethod.cardholderName && (
                        <div className="text-muted-foreground">
                          Cardholder: {transaction.paymentMethod.cardholderName}
                        </div>
                      )}
                    </div>

                    {transaction.location && (
                      <>
                        <Separator />
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="capitalize">{transaction.channel.replace("_", " ")}</span>
                          </div>
                          <div className="text-muted-foreground">Location: {transaction.location.name}</div>
                          {transaction.terminal && (
                            <div className="text-muted-foreground">Terminal: {transaction.terminal.terminalId}</div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Order Details */}
                {transaction.order && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Order Details</CardTitle>
                        <Button variant="link" size="sm" className="h-auto p-0">
                          View Full Order
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-sm">
                        <span className="font-medium">Order #{transaction.order.orderNumber}</span>
                        {transaction.order.tableNumber && <span> • Table {transaction.order.tableNumber}</span>}
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Items ({transaction.order.items.length}):</div>
                        {transaction.order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>
                              {item.quantity}× {item.name}
                            </span>
                            <span>€{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>€{transaction.order.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Tax ({((transaction.order.tax / transaction.order.subtotal) * 100).toFixed(0)}%):
                          </span>
                          <span>€{transaction.order.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tip:</span>
                          <span>€{transaction.order.tip.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-medium pt-1">
                          <span>Total:</span>
                          <span>€{transaction.order.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {transaction.order.customer && (
                        <>
                          <Separator />
                          <div className="space-y-2 text-sm">
                            <div className="font-medium flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Customer:
                            </div>
                            <div>{transaction.order.customer.name}</div>
                            <div className="text-muted-foreground">{transaction.order.customer.email}</div>
                            <div className="text-muted-foreground">{displayPhone(transaction.order.customer.phone)}</div>
                            {transaction.order.customer.loyaltyTier && (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="capitalize">
                                  {transaction.order.customer.loyaltyTier} Member
                                </Badge>
                                <span className="text-muted-foreground">
                                  {transaction.order.customer.loyaltyPoints?.toLocaleString()} points
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {transaction.order.server && (
                        <>
                          <Separator />
                          <div className="text-sm space-y-1">
                            <div>
                              <span className="font-medium">Server:</span> {transaction.order.server.name}
                            </div>
                            {transaction.order.shift && (
                              <div className="text-muted-foreground capitalize">Shift: {transaction.order.shift}</div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Timeline & Audit */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Timeline & Audit</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {transaction.timeline.slice(0, showAllTimeline ? undefined : 5).map((event, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">{getTimelineIcon(event.status)}</div>
                        <div className="flex-1 space-y-1">
                          <div className="text-sm font-medium">
                            {format(new Date(event.timestamp), "MMM dd, h:mm a")}
                          </div>
                          <div className="text-sm capitalize">{event.event.replace("_", " ")}</div>
                          <div className="text-sm text-muted-foreground">{event.details}</div>
                          <div className="text-xs text-muted-foreground">By: {event.actor}</div>
                        </div>
                      </div>
                    ))}

                    {transaction.timeline.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowAllTimeline(!showAllTimeline)}
                      >
                        {showAllTimeline ? "Hide Details" : `Show All Events (${transaction.timeline.length})`}
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Refund History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Refund History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {transaction.refunds.length === 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">No refunds for this transaction</p>
                        {refundableAmount > 0 && transaction.status !== "failed" && (
                          <>
                            <div className="text-sm">
                              <span className="font-medium">Refundable amount:</span> €{refundableAmount.toFixed(2)}
                            </div>
                            <Button size="sm" className="w-full" onClick={handleRefundClick}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Issue Refund
                            </Button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {/* ... existing refunds display ... */}
                        {transaction.refunds.map((refund, idx) => (
                          <Card key={idx} className="bg-muted/30">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{refund.refundId}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <RotateCcw className="h-3 w-3" />
                                    <span className="text-sm capitalize">
                                      {refund.amount === transaction.amount ? "Full" : "Partial"} Refund
                                    </span>
                                    <span>•</span>
                                    <Badge variant="success" className="text-xs">
                                      {refund.status}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="text-lg font-semibold">€{refund.amount.toFixed(2)}</div>
                              </div>

                              <Separator />

                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Refunded:</span>{" "}
                                  {format(new Date(refund.createdAt), "MMM dd, h:mm a")}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Reason:</span>{" "}
                                  <span className="capitalize">{refund.reason.replace(/_/g, " ")}</span>
                                </div>
                                {refund.reasonDescription && (
                                  <div className="text-muted-foreground italic">"{refund.reasonDescription}"</div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">Processed by:</span> {refund.processedBy}
                                  {refund.processedByEmail && (
                                    <span className="text-muted-foreground"> ({refund.processedByEmail})</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Destination:</span> {refund.destination}
                                </div>
                                {refund.destinationDetails && (
                                  <div className="text-muted-foreground">{refund.destinationDetails}</div>
                                )}
                                {refund.completedAt && (
                                  <div>
                                    <span className="text-muted-foreground">Status:</span> Completed
                                    <span className="ml-2">
                                      ({formatDistanceToNow(new Date(refund.completedAt), { addSuffix: true })})
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                                  <Eye className="mr-2 h-3 w-3" />
                                  View Details
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                                  <FileText className="mr-2 h-3 w-3" />
                                  Receipt
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        {refundableAmount > 0 && (
                          <div className="space-y-3">
                            <Separator />
                            <div className="text-sm">
                              <span className="font-medium">Available for refund:</span> €{refundableAmount.toFixed(2)}
                            </div>
                            <Button size="sm" className="w-full" onClick={handleRefundClick}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Issue Another Refund
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Metadata & Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Metadata & Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Tags:</div>
                      <div className="flex flex-wrap gap-2">
                        {transaction.metadata.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                        <Button variant="outline" size="sm" className="h-6 px-2 bg-transparent">
                          <Tag className="mr-1 h-3 w-3" />
                          Add Tag
                        </Button>
                      </div>
                    </div>

                    {transaction.metadata.notes.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <div className="text-sm font-medium mb-3">
                            Internal Notes ({transaction.metadata.notes.length}):
                          </div>
                          <div className="space-y-3">
                            {transaction.metadata.notes.map((note) => (
                              <Card key={note.noteId} className="bg-muted/30">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2 text-sm">
                                      {note.pinned && (
                                        <Badge variant="secondary" className="h-5 text-xs">
                                          Pinned
                                        </Badge>
                                      )}
                                      <span className="font-medium">
                                        {format(new Date(note.createdAt), "MMM dd, h:mm a")}
                                      </span>
                                      <span className="text-muted-foreground">- {note.author}</span>
                                      {note.authorRole && (
                                        <span className="text-muted-foreground text-xs">({note.authorRole})</span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm">{note.content}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Add Note
                    </Button>

                    {transaction.metadata.customFields && Object.keys(transaction.metadata.customFields).length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <div className="text-sm font-medium mb-2">Custom Fields:</div>
                          <div className="space-y-1 text-sm">
                            {Object.entries(transaction.metadata.customFields).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-muted-foreground capitalize">{key}:</span> {value}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Processor Info */}
                <Collapsible>
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Processor Info</CardTitle>
                          <ChevronDown className="h-4 w-4 transition-transform" />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-3">
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="font-medium">Provider:</span> {transaction.processor.provider}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Processor ID:</span>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {transaction.processor.processorId}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(transaction.processor.processorId)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 px-2">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              View in {transaction.processor.provider}
                            </Button>
                          </div>

                          {transaction.processor.paymentIntentId && (
                            <div>
                              <span className="font-medium">Payment Intent:</span>{" "}
                              <code className="text-xs">{transaction.processor.paymentIntentId}</code>
                            </div>
                          )}

                          {transaction.processor.payoutId && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Payout ID:</span>
                              <code className="text-xs">{transaction.processor.payoutId}</code>
                              <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                                View Payout
                                <ChevronRight className="ml-1 h-3 w-3" />
                              </Button>
                            </div>
                          )}

                          {transaction.processor.riskScore !== undefined && (
                            <>
                              <Separator />
                              <div>
                                <div className="font-medium mb-2">Risk Evaluation:</div>
                                <div className="space-y-1 text-sm">
                                  <div>
                                    Risk Score: {transaction.processor.riskScore} (
                                    <span className="capitalize">{transaction.processor.riskLevel}</span>)
                                  </div>
                                  {transaction.processor.fraudDetection && (
                                    <div className="capitalize">
                                      Fraud Detection: {transaction.processor.fraudDetection}
                                    </div>
                                  )}
                                  <div>3D Secure: {transaction.processor.threeDSecure ? "Yes" : "Not required"}</div>
                                </div>
                              </div>
                            </>
                          )}

                          {transaction.processor.rawResponse && (
                            <>
                              <Separator />
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-between bg-transparent"
                                onClick={() => setShowRawResponse(!showRawResponse)}
                              >
                                Raw Response
                                {showRawResponse ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              {showRawResponse && (
                                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                                  {JSON.stringify(transaction.processor.rawResponse, null, 2)}
                                </pre>
                              )}
                            </>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Related Transactions */}
                {transaction.relatedTransactions && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Related Transactions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {transaction.relatedTransactions.sameOrder &&
                        transaction.relatedTransactions.sameOrder.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-2">Same Order:</div>
                            <div className="space-y-2">
                              {transaction.relatedTransactions.sameOrder.map((txId) => (
                                <Button
                                  key={txId}
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-between bg-transparent"
                                >
                                  {txId}
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                      {transaction.relatedTransactions.sameCustomer && (
                        <>
                          {transaction.relatedTransactions.sameOrder && <Separator />}
                          <div>
                            <div className="text-sm font-medium mb-2">Same Customer (last 30 days):</div>
                            <Card className="bg-muted/30">
                              <CardContent className="p-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span>{transaction.relatedTransactions.sameCustomer.count} transactions</span>
                                  <span className="font-medium">
                                    Total: €{transaction.relatedTransactions.sameCustomer.total.toFixed(2)}
                                  </span>
                                </div>
                                {transaction.relatedTransactions.sameCustomer.last30Days.length > 0 && (
                                  <div className="space-y-1 pt-2">
                                    <div className="text-xs text-muted-foreground">Recent:</div>
                                    {transaction.relatedTransactions.sameCustomer.last30Days.map((tx) => (
                                      <div key={tx.transactionId} className="flex justify-between text-xs">
                                        <span>
                                          {format(new Date(tx.date), "MMM dd")} - €{tx.amount.toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                                  View All Transactions
                                  <ChevronRight className="ml-1 h-3 w-3" />
                                </Button>
                              </CardContent>
                            </Card>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Receipt & Documents */}
                {transaction.receipt && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Receipt & Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm">
                          <FileText className="mr-2 h-4 w-4" />
                          View Receipt
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </Button>
                        <Button variant="outline" size="sm">
                          <Mail className="mr-2 h-4 w-4" />
                          Email Receipt
                        </Button>
                        <Button variant="outline" size="sm">
                          <Printer className="mr-2 h-4 w-4" />
                          Print
                        </Button>
                      </div>

                      {transaction.receipt.sent && (
                        <>
                          <Separator />
                          <div className="text-sm space-y-1">
                            <div className="font-medium">Receipt sent to:</div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{transaction.receipt.sentTo}</span>
                              {transaction.receipt.sentAt && (
                                <span className="text-muted-foreground">
                                  ({format(new Date(transaction.receipt.sentAt), "MMM dd, h:mm a")})
                                </span>
                              )}
                            </div>
                            {transaction.receipt.deliveryStatus === "delivered" && (
                              <div className="flex items-center gap-1 text-success">
                                <CheckCircle className="h-4 w-4" />
                                Delivered
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Footer Actions */}
              <div className="sticky bottom-0 border-t bg-background p-4">
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
                    Close
                  </Button>
                  {transaction.status === "succeeded" && refundableAmount > 0 && (
                    <Button className="flex-1" onClick={handleRefundClick}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Issue Refund
                    </Button>
                  )}
                  {transaction.status === "failed" && (
                    <Button className="flex-1">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Payment
                    </Button>
                  )}
                  {dispute && (
                    <Button className="flex-1" onClick={handleManageDispute}>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Manage Dispute
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1 bg-transparent">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <RefundModal
        transaction={transaction}
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        onRefundComplete={() => {
          // In a real app, this would refetch transaction data
          console.log("[v0] Refund completed, should refresh transaction data")
        }}
      />

      {dispute && (
        <ManageDisputeModal
          dispute={dispute}
          open={disputeModalOpen}
          onClose={() => setDisputeModalOpen(false)}
          onSubmitResponse={(data) => {
            console.log("[v0] Dispute response submitted:", data)
            // In a real app, this would submit to the backend
            setDisputeModalOpen(false)
          }}
        />
      )}
    </>
  )
}
