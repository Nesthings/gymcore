import { useCallback, useState } from 'react'
import { History, QrCode, Ticket } from 'lucide-react'

import { PassRedeem } from '@/components/checkin/PassRedeem'
import { CheckinScanner } from '@/components/checkin/CheckinScanner'
import { TodayCheckins } from '@/components/checkin/TodayCheckins'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function Checkin() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleChecked = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <AppLayout>
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Check-in</h1>
        <p className="text-sm text-muted-foreground">
          Registra la entrada de socios por nombre o escaneando su código QR
        </p>
      </div>

      <Tabs defaultValue="scanner" className="space-y-4">
        <TabsList className="w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-auto sm:overflow-visible">
          <TabsTrigger value="scanner">
            <QrCode className="size-4" /> Check-in QR
          </TabsTrigger>
          <TabsTrigger value="today">
            <History className="size-4" /> Check-ins de hoy
          </TabsTrigger>
          <TabsTrigger value="passes">
            <Ticket className="size-4" /> Canjear pase
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scanner">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Registrar entrada</CardTitle>
              <CardDescription>
                Busca al socio por nombre o correo, o escanea el código QR de su credencial.
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
              <CardDescription>Registro en tiempo real de los check-ins del día.</CardDescription>
            </CardHeader>
            <CardContent>
              <TodayCheckins refreshKey={refreshKey} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passes">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="size-4 text-primary" /> Canjear pase de invitado
              </CardTitle>
              <CardDescription>
                El invitado muestra el QR o te pasa el token de su pase; al canjearlo entra y se crea
                un lead automáticamente en el CRM.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PassRedeem />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  )
}