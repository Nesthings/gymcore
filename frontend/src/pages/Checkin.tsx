import { useCallback, useState } from 'react'
import { History, QrCode } from 'lucide-react'

import { CheckinScanner } from '@/components/checkin/CheckinScanner'
import { TodayCheckins } from '@/components/checkin/TodayCheckins'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function Checkin() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleChecked = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <AppLayout>
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Check-ins"
        subtitle="Registra la entrada de socios por nombre o escaneando su código QR"
        icon={QrCode}
      />

      <Tabs defaultValue="scanner" className="space-y-4">
        <TabsList className="w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-auto sm:overflow-visible">
          <TabsTrigger value="scanner">
            <QrCode className="size-4" /> Check-ins QR
          </TabsTrigger>
          <TabsTrigger value="today">
            <History className="size-4" /> Check-ins de hoy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scanner">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Registrar entrada</CardTitle>
              <CardDescription>
                Busca al socio por nombre o correo, o escanea el código QR de su credencial. Los
                pases de invitado se canjean solos con el lector continuo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CheckinScanner onChecked={handleChecked} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Visitas de hoy</CardTitle>
              <CardDescription>Registro en tiempo real de entradas y salidas del día.</CardDescription>
            </CardHeader>
            <CardContent>
              <TodayCheckins refreshKey={refreshKey} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  )
}