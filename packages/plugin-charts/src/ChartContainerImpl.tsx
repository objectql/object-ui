/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client"

import * as React from "react"
import { ResponsiveContainer, Tooltip, Legend } from "recharts"

// Utility function to merge class names (inline to avoid external dependency)
const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ')

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof ResponsiveContainer
  >["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  // Re-mount the chart exactly ONCE, after its container has settled at a real,
  // non-zero size. Why: a Recharts bar/area/line entrance animation is a
  // requestAnimationFrame tween that starts at height 0 (see recharts'
  // JavascriptAnimate: `useState(isActive ? 0 : 1)`). Inside a react-grid-layout
  // dashboard the widget's box settles over several frames right after mount,
  // and the tween kicked off during that churn can be interrupted before it ever
  // advances past 0 — so the chart paints its axes/labels but the bars stay stuck
  // at height 0. Any *unrelated* later re-render (a theme toggle, a manual
  // resize) mints a fresh Recharts `animationId`, which re-keys the tween and
  // lets it replay to completion — which is why the bars "appear on resize". We
  // reproduce that single healing re-render automatically: once the ResizeObserver
  // reports that size changes have stopped at a positive box, we bump
  // `settleNonce`, which re-keys the ResponsiveContainer below so the whole chart
  // performs one clean re-mount in a quiet window. The entrance animation then
  // runs uninterrupted and the bars actually draw on first paint.
  //
  // The nonce only ever bumps under a genuine layout engine (a positive, stable
  // box). Headless/jsdom/happy-dom renders report a 0×0 box, so `settleNonce`
  // stays 0 and those tests see a single, ordinary render. See
  // dashboard-chart-empty-first-render.
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [settleNonce, setSettleNonce] = React.useState(0)
  React.useEffect(() => {
    const el = containerRef.current
    if (el == null || typeof ResizeObserver === "undefined") return

    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver((entries) => {
      if (settled) return
      const box = entries[0]?.contentRect
      if (box == null || box.width <= 0 || box.height <= 0) return
      // Debounce: only re-mount once size changes have STOPPED, so we replay the
      // entrance animation after the grid finishes settling — not midway through
      // it (which would just re-arm the same race).
      if (timer != null) clearTimeout(timer)
      timer = setTimeout(() => {
        settled = true
        observer.disconnect()
        setSettleNonce((n) => n + 1)
      }, 80)
    })
    observer.observe(el)
    return () => {
      settled = true
      if (timer != null) clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={containerRef}
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          // Block (not flex) so Recharts' ResponsiveContainer child fills the
          // box. Under `flex ... justify-center` the container collapsed to its
          // content width (0) on first paint inside react-grid-layout, so
          // Recharts measured width(-1) and rendered nothing until a later
          // resize fired its ResizeObserver — leaving dashboard charts blank.
          "block w-full h-[350px] text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          className
        )}
        // Guarantee a non-zero box for Recharts' ResponsiveContainer even when
        // the consumer-supplied className overrides our h-[350px] (e.g. dashboard
        // widgets that wrap the chart in flex/grid layouts without an explicit
        // child height). Without this min-size the chart computes
        // width/height = -1 and renders invisibly.
        style={{ minHeight: 280, minWidth: 0, ...props.style }}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer key={settleNonce} width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

const ChartTooltip = Tooltip

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: any) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === "string"
        ? config[label as keyof typeof config]?.label || label
        : itemConfig?.label

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      )
    }

    if (!value) {
      return null
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload
          .filter((item: any) => item.type !== "none")
          .map((item: any, index: number) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color || item.payload.fill || item.color

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
                  indicator === "dot" ? "items-center" : ""
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                            indicator === "dot" ? "h-2.5 w-2.5" : "",
                            indicator === "line" ? "w-1" : "",
                            indicator === "dashed" ? "w-0 border-[1.5px] border-dashed bg-transparent" : "",
                            (nestLabel && indicator === "dashed") ? "my-0.5" : "",
                          )}
                          style={

                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

const ChartLegend = Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: any) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload
        .filter((item: any) => item.type !== "none")
        .map((item: any) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={item.value}
              className={cn(
                "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
