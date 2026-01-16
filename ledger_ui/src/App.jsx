import { useState, useEffect } from 'react';
import {
  AppShell, Container, Table, Title, Text, Badge, Group, Alert,
  Button, Modal, TextInput, Stack, Drawer, NumberInput, Divider, Tabs, Select,
  ActionIcon, Avatar, Paper, SimpleGrid, useMantineColorScheme, Burger,
  ThemeIcon, Center, PasswordInput, ScrollArea
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconUserPlus, IconCurrencyDollar, IconSearch,
  IconUsers, IconReceipt, IconNote, IconPlus, IconChartBar,
  IconPhone, IconMapPin, IconMail, IconLock, IconShieldLock, IconTrash
} from '@tabler/icons-react';

// --- HELPERS ---
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
});
const formatMoney = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const getInitials = (name) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

function App() {
  const { colorScheme } = useMantineColorScheme();

  // --- RESPONSIVE STATE ---
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();

  // --- AUTH STATE ---
  const [token, setToken] = useState(localStorage.getItem('ledger_token'));
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('ledger_is_admin') === 'true');

  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // --- ADMIN STATE ---
  const [adminModalOpened, { open: openAdminModal, close: closeAdminModal }] = useDisclosure(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');

  // --- DATA STATE ---
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search
  const [customerSearch, setCustomerSearch] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');

  // Modals/Drawers
  const [opened, { open, close }] = useDisclosure(false);
  const [txModalOpened, { open: openTxModal, close: closeTxModal }] = useDisclosure(false);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);

  // Forms
  const [formData, setFormData] = useState({ CustomerName: '', Email: '', PhoneNumber: '', HomeAddress: '' });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [txForm, setTxForm] = useState({ customerId: null, amount: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // --- AUTH HANDLERS ---
  const handleAuth = async () => {
    setAuthLoading(true); setAuthError('');

    const body = new URLSearchParams();
    body.append('username', authEmail);
    body.append('password', authPass);

    try {
      // URL CHANGED: Using relative path '/token' instead of absolute http://127.0.0.1...
      const res = await fetch(`/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Auth failed');

      localStorage.setItem('ledger_token', data.access_token);
      localStorage.setItem('ledger_is_admin', data.is_admin);

      setToken(data.access_token);
      setIsAdmin(data.is_admin);
      window.location.reload();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('ledger_token');
    localStorage.removeItem('ledger_is_admin');
    setToken(null);
    setIsAdmin(false);
    setCustomers([]);
  };

  const authenticatedFetch = async (url, options = {}) => {
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) { logout(); throw new Error("Session expired"); }
    return res;
  };

  // --- ADMIN HANDLERS ---
  const fetchAdminUsers = async () => {
    try {
      const res = await authenticatedFetch('/admin/users');
      const data = await res.json();
      setAdminUsers(data);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  useEffect(() => {
    if (adminModalOpened) fetchAdminUsers();
  }, [adminModalOpened]);

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPass) return;
    try {
      await authenticatedFetch('/admin/create-user', {
        method: 'POST',
        body: JSON.stringify({ email: newUserEmail, password: newUserPass })
      });
      setNewUserEmail(''); setNewUserPass('');
      fetchAdminUsers();

      notifications.show({ title: 'Admin Action', message: 'New user created successfully', color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    try {
      await authenticatedFetch(`/admin/users/${id}`, { method: 'DELETE' });
      fetchAdminUsers();
      notifications.show({ title: 'User Deleted', message: 'The user has been removed from the system.', color: 'blue' });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  // --- API LOGIC ---
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [custRes, txRes] = await Promise.all([
        authenticatedFetch('/customers/'),
        authenticatedFetch('/transactions/')
      ]);
      const custData = await custRes.json();
      const txData = await txRes.json();

      setCustomers(custData);
      setTransactions(txData.sort((a, b) => new Date(b.EntryDate) - new Date(a.EntryDate)));

      if (selectedCustomer) {
        const updated = custData.find(c => c.CustomerID === selectedCustomer.CustomerID);
        if (updated) setSelectedCustomer(updated);
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [token]);

  // --- DATA HANDLERS ---
  const handleCreateCustomer = async () => {
    setFormError(''); setSubmitting(true);
    try {
      const res = await authenticatedFetch('/customers/', {
        method: 'POST', body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      close();
      setFormData({ CustomerName: '', Email: '', PhoneNumber: '', HomeAddress: '' });
      fetchData();

      notifications.show({ title: 'Success', message: 'Customer added to database', color: 'teal' });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransactionSubmit = async (source) => {
    let cid = source === 'drawer' ? selectedCustomer.CustomerID : txForm.customerId;
    if (!cid || !txForm.amount) return;
    setTxSubmitting(true);
    try {
      const res = await authenticatedFetch('/transactions/', {
        method: 'POST',
        body: JSON.stringify({ CustomerID: cid, Amount: parseFloat(txForm.amount), Notes: txForm.notes, EntryDate: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Transaction Failed");
      setTxForm({ customerId: null, amount: '', notes: '' });
      closeTxModal();
      fetchData();

      notifications.show({ title: 'Transaction Recorded', message: `Successfully processed $${txForm.amount}`, color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Transaction Failed', message: err.message, color: 'red' });
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleRowClick = (c) => { setSelectedCustomer(c); setTxForm({ customerId: null, amount: '', notes: '' }); openDrawer(); };

  // --- STATS & FILTERS ---
  const totalBalance = transactions.reduce((acc, tx) => acc + parseFloat(tx.Amount), 0);
  const avgTransaction = transactions.length > 0 ? totalBalance / transactions.length : 0;

  const filteredCustomers = customers.filter(c =>
    c.CustomerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.Email && c.Email.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  const filteredTransactions = transactions.filter(tx => {
    const cName = customers.find(c => c.CustomerID === tx.CustomerID)?.CustomerName || '';
    const query = transactionSearch.toLowerCase();
    return cName.toLowerCase().includes(query) || (tx.Notes && tx.Notes.toLowerCase().includes(query));
  });

  const customerOptions = customers.map(c => ({ value: c.CustomerID.toString(), label: `${c.CustomerName} (#${c.CustomerID})` }));

  // --- VIEW: LOGIN SCREEN ---
  if (!token) {
    return (
      <Container size="xs" mt={100}>
        <Paper withBorder p="xl" radius="md" shadow="lg">
          <Center mb="md">
            <img src="/logo.png" alt="Logo" style={{ height: 60 }} />
          </Center>
          <Title ta="center" order={2} mb="md">Authorized Access Only</Title>
          <Stack>
            {authError && <Alert color="red">{authError}</Alert>}
            <TextInput label="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} leftSection={<IconMail size={16} />} />
            <PasswordInput
              label="Password"
              value={authPass}
              onChange={(e) => setAuthPass(e.target.value)}
              leftSection={<IconLock size={16} />}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAuth() }}
            />
            <Button fullWidth onClick={handleAuth} loading={authLoading}>Sign In</Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // --- VIEW: MAIN APP (RESPONSIVE) ---
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { desktop: true, mobile: !mobileOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" px="md" justify="space-between">
            <Group>
              {/* Burger for Mobile */}
              <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />

              <img src="/logo.png" alt="Logo" style={{ height: 35, width: 'auto' }} />
              <Text fw={800} size="xl">LedgerPro</Text>
            </Group>

            {/* Desktop Buttons (Hidden on Mobile) */}
            <Group visibleFrom="sm">
              <Button variant="light" leftSection={<IconUserPlus size={18} />} onClick={open}>Add Customer</Button>
              <Button variant="filled" leftSection={<IconPlus size={18} stroke={3} />} onClick={openTxModal}>New Transaction</Button>

              {isAdmin && (
                <Button variant="light" color="orange" leftSection={<IconShieldLock size={18} />} onClick={openAdminModal}>
                  Admin Panel
                </Button>
              )}

              <Divider orientation="vertical" mx="xs" />
              <Button variant="subtle" color="red" size="xs" onClick={logout}>Logout</Button>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      {/* Mobile Sidebar (Hidden on Desktop) */}
      <AppShell.Navbar p="md">
        <Stack>
          <Text size="sm" c="dimmed" fw={700}>MENU</Text>
          <Button fullWidth variant="light" leftSection={<IconUserPlus size={18} />} onClick={() => { open(); closeMobile(); }}>Add Customer</Button>
          <Button fullWidth variant="filled" leftSection={<IconPlus size={18} stroke={3} />} onClick={() => { openTxModal(); closeMobile(); }}>New Transaction</Button>
          {isAdmin && (
            <Button fullWidth variant="light" color="orange" leftSection={<IconShieldLock size={18} />} onClick={() => { openAdminModal(); closeMobile(); }}>Admin Panel</Button>
          )}
          <Divider my="sm" />
          <Button fullWidth variant="subtle" color="red" onClick={logout}>Logout</Button>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main bg={colorScheme === 'dark' ? 'dark.8' : 'gray.0'}>
        <Container size="xl">
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
            <Paper p="md" radius="md" shadow="xs" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Total Volume</Text>
                  <Text fw={700} size="xl">{formatMoney(totalBalance)}</Text>
                </div>
                <ThemeIcon variant="light" size="xl" radius="md"><IconCurrencyDollar /></ThemeIcon>
              </Group>
            </Paper>

            <Paper p="md" radius="md" shadow="xs" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Total Customers</Text>
                  <Text fw={700} size="xl">{customers.length}</Text>
                </div>
                <ThemeIcon variant="light" size="xl" radius="md"><IconUsers /></ThemeIcon>
              </Group>
            </Paper>

            <Paper p="md" radius="md" shadow="xs" withBorder>
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Avg. Transaction</Text>
                  <Text fw={700} size="xl">{formatMoney(avgTransaction)}</Text>
                </div>
                <ThemeIcon variant="light" size="xl" radius="md"><IconChartBar /></ThemeIcon>
              </Group>
            </Paper>
          </SimpleGrid>

          {error && <Alert color="red" title="System Error" mb="md">{error}</Alert>}

          <Paper shadow="sm" radius="md" withBorder p="md">
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List mb="md">
                <Tabs.Tab value="customers" leftSection={<IconUsers size={16} />}>Customers</Tabs.Tab>
                <Tabs.Tab value="transactions" leftSection={<IconReceipt size={16} />}>Transactions</Tabs.Tab>
              </Tabs.List>

              {/* --- DYNAMIC HEATMAP CUSTOMER TABLE --- */}
              <Tabs.Panel value="customers">
                <TextInput leftSection={<IconSearch size={16} />} placeholder="Search customers..." mb="md" value={customerSearch} onChange={(e) => setCustomerSearch(e.currentTarget.value)} />

                <ScrollArea>
                  {(() => {
                    const counts = customers
                      .map(c => c.transactions?.length || 0)
                      .filter(n => n > 0)
                      .sort((a, b) => a - b);
                    const lowCutoff = counts[Math.floor(counts.length * 0.33)] || 0;
                    const highCutoff = counts[Math.floor(counts.length * 0.66)] || 0;

                    return (
                      <Table striped highlightOnHover verticalSpacing="sm" minWidth={600}>
                        <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Contact</Table.Th><Table.Th>Address</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {filteredCustomers.map(c => {
                            const count = c.transactions?.length || 0;
                            let badgeColor = 'gray';
                            let badgeLabel = 'Inactive';
                            if (count > 0) {
                              if (count >= highCutoff) badgeColor = 'green';
                              else if (count >= lowCutoff) badgeColor = 'cyan';
                              else badgeColor = 'blue';
                              badgeLabel = `${count} Txns`;
                            }
                            return (
                              <Table.Tr key={c.CustomerID} onClick={() => handleRowClick(c)} style={{ cursor: 'pointer' }}>
                                <Table.Td>
                                  <Group gap="sm">
                                    <Avatar radius="xl">{getInitials(c.CustomerName)}</Avatar>
                                    <div>
                                      <Text fw={500}>{c.CustomerName}</Text>
                                      <Text size="xs" c="dimmed">ID: {c.CustomerID}</Text>
                                    </div>
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm">{c.Email || '-'}</Text>
                                  <Text size="xs" c="dimmed">{c.PhoneNumber}</Text>
                                </Table.Td>
                                <Table.Td><Text size="sm" lineClamp={1} w={200}>{c.HomeAddress || '-'}</Text></Table.Td>
                                <Table.Td>
                                  <Badge color={badgeColor} variant="light">{badgeLabel}</Badge>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    );
                  })()}
                </ScrollArea>
              </Tabs.Panel>

              <Tabs.Panel value="transactions">
                <TextInput leftSection={<IconSearch size={16} />} placeholder="Search transactions..." mb="md" value={transactionSearch} onChange={(e) => setTransactionSearch(e.currentTarget.value)} />
                <ScrollArea>
                  <Table striped highlightOnHover verticalSpacing="xs" minWidth={600}>
                    <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Notes</Table.Th><Table.Th align="right">Amount</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {filteredTransactions.map(tx => (
                        <Table.Tr key={tx.TransactionID}>
                          <Table.Td><Text size="sm">{formatDate(tx.EntryDate)}</Text></Table.Td>
                          <Table.Td><Text fw={500} size="sm">{customers.find(c => c.CustomerID === tx.CustomerID)?.CustomerName}</Text></Table.Td>
                          <Table.Td><Text size="sm" c="dimmed" fs="italic">{tx.Notes || '-'}</Text></Table.Td>
                          <Table.Td align="right">
                            <Text fw={700} c={tx.Amount >= 0 ? 'green' : 'red'}>
                              {tx.Amount > 0 ? '+' : ''}{formatMoney(tx.Amount)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Container>
      </AppShell.Main>

      {/* --- MODAL 1: Create Customer --- */}
      <Modal opened={opened} onClose={close} title="New Customer" centered>
        <Stack>
          {formError && <Text c="red" size="sm">{formError}</Text>}
          <TextInput label="Name" required data-autofocus name="CustomerName" value={formData.CustomerName} onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })} />
          <TextInput label="Email" name="Email" value={formData.Email} onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })} />
          <TextInput label="Phone" name="PhoneNumber" value={formData.PhoneNumber} onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })} />
          <TextInput label="Address" name="HomeAddress" value={formData.HomeAddress} onChange={(e) => setFormData({ ...formData, [e.target.name]: e.target.value })} />
          <Button fullWidth mt="md" onClick={handleCreateCustomer} loading={submitting}>Create Customer</Button>
        </Stack>
      </Modal>

      {/* --- MODAL 2: Create Transaction (Global) --- */}
      <Modal opened={txModalOpened} onClose={closeTxModal} title="Record Transaction" centered>
        <Stack>
          <Select label="Select Customer" placeholder="Search..." searchable data={customerOptions} value={txForm.customerId ? txForm.customerId.toString() : null} onChange={(val) => setTxForm({ ...txForm, customerId: val })} />
          <NumberInput label="Amount" placeholder="0.00" prefix="$" decimalScale={2} value={txForm.amount} onChange={(val) => setTxForm({ ...txForm, amount: val })} />
          <TextInput label="Notes" placeholder="Invoice #, Refund, etc." leftSection={<IconNote size={16} />} value={txForm.notes} onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })} />
          <Button fullWidth mt="md" onClick={() => handleTransactionSubmit('global')} loading={txSubmitting} disabled={!txForm.customerId || !txForm.amount}>Post Transaction</Button>
        </Stack>
      </Modal>

      {/* --- MODAL 3: User Management (Admin Only) --- */}
      <Modal opened={adminModalOpened} onClose={closeAdminModal} title="User Management" size="lg" centered>
        <Stack>
          <Paper withBorder p="md" bg="var(--mantine-color-gray-0)">
            <Text size="sm" fw={700} mb="xs">Add New User</Text>
            <Group align="flex-end">
              <TextInput placeholder="Email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} leftSection={<IconMail size={16} />} style={{ flex: 1 }} />
              <PasswordInput placeholder="Password" value={newUserPass} onChange={(e) => setNewUserPass(e.target.value)} leftSection={<IconLock size={16} />} style={{ flex: 1 }} />
              <Button color="orange" onClick={handleCreateUser}>Add</Button>
            </Group>
          </Paper>

          <Divider label="Existing Users" labelPosition="center" />

          <Table>
            <Table.Thead><Table.Tr><Table.Th>ID</Table.Th><Table.Th>Email</Table.Th><Table.Th>Role</Table.Th><Table.Th>Action</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {adminUsers.map(u => (
                <Table.Tr key={u.id}>
                  <Table.Td>{u.id}</Table.Td>
                  <Table.Td>{u.email}</Table.Td>
                  <Table.Td>{u.is_admin ? <Badge color="orange">Admin</Badge> : <Badge color="gray">User</Badge>}</Table.Td>
                  <Table.Td>
                    <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteUser(u.id)} disabled={u.email === authEmail}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Modal>

      {/* --- DRAWER: Customer Details --- */}
      <Drawer opened={drawerOpened} onClose={closeDrawer} position="right" size="md" title="Customer Overview">
        {selectedCustomer && (
          <Stack>
            <Paper withBorder p="md" radius="md" bg="var(--mantine-color-gray-0)">
              <Center mb="sm"><Avatar size="xl" radius="xl">{getInitials(selectedCustomer.CustomerName)}</Avatar></Center>
              <Text ta="center" size="xl" fw={700} mb="md">{selectedCustomer.CustomerName}</Text>

              <Stack gap="sm" mb="md">
                <Group wrap="nowrap"><ThemeIcon variant="light" color="gray" size="sm"><IconMail size={14} /></ThemeIcon><Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>{selectedCustomer.Email || 'No Email'}</Text></Group>
                <Group wrap="nowrap"><ThemeIcon variant="light" color="gray" size="sm"><IconPhone size={14} /></ThemeIcon><Text size="sm" c="dimmed">{selectedCustomer.PhoneNumber || 'No Phone'}</Text></Group>
                <Group wrap="nowrap"><ThemeIcon variant="light" color="gray" size="sm"><IconMapPin size={14} /></ThemeIcon><Text size="sm" c="dimmed" style={{ whiteSpace: 'normal' }}>{selectedCustomer.HomeAddress || 'No Address'}</Text></Group>
              </Stack>

              <Divider my="sm" />
              <Group justify="space-between">
                <Text size="sm" fw={500}>Current Balance</Text>
                <Text size="xl" fw={700} c={(selectedCustomer.transactions?.reduce((a, t) => a + parseFloat(t.Amount), 0) || 0) >= 0 ? 'green' : 'red'}>
                  {formatMoney(selectedCustomer.transactions?.reduce((a, t) => a + parseFloat(t.Amount), 0) || 0)}
                </Text>
              </Group>
            </Paper>

            <Text fw={600} size="sm" mt="md">Quick Action</Text>
            <Group align="end" grow>
              <NumberInput prefix="$" placeholder="0.00" value={txForm.amount} onChange={(val) => setTxForm({ ...txForm, amount: val })} />
              <Button onClick={() => handleTransactionSubmit('drawer')} loading={txSubmitting}>Post</Button>
            </Group>
            <TextInput placeholder="Add a note..." mt="xs" leftSection={<IconNote size={16} />} value={txForm.notes} onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })} />

            <Divider label="History" labelPosition="center" mt="lg" />
            <Stack gap="xs">
              {[...(selectedCustomer.transactions || [])].reverse().map(tx => (
                <Paper key={tx.TransactionID} withBorder p="sm" radius="md">
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" c="dimmed">{formatDate(tx.EntryDate)}</Text>
                    <Text fw={700} c={parseFloat(tx.Amount) >= 0 ? 'green' : 'red'}>
                      {parseFloat(tx.Amount) > 0 ? '+' : ''}{formatMoney(tx.Amount)}
                    </Text>
                  </Group>
                  {tx.Notes && <Text size="sm" fs="italic">{tx.Notes}</Text>}
                </Paper>
              ))}
            </Stack>
          </Stack>
        )}
      </Drawer>
    </AppShell>
  );
}

export default App;
