import { useForm } from '@mantine/form';
import { resumeAndPrerenderToNodeStream } from 'react-dom/static';
import { Button, Checkbox, Group, TextInput } from '@mantine/core';


export function CreateNewCollectionPrompt(){

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      email: '',
      user: {
        firstName: '',
        lastName: '',
      },
    },
    validate: {
      email: (value) => (value.length < 2 ? 'Invalid email' : null),
      user: {
        firstName: (value) =>
          value.length < 2
            ? 'First name must have at least 2 letters'
            : null,
      },
    },
  });

  return(
    <form onSubmit={form.onSubmit((values) => console.log(values))}>
      <TextInput
        withAsterisk
        label="Email"
        placeholder="your@email.com"
        key={form.key('email')}
        {...form.getInputProps('email')}
      />

      <Checkbox
        mt="md"
        label="I agree to sell my privacy"
        key={form.key('termsOfService')}
        {...form.getInputProps('termsOfService', { type: 'checkbox' })}
      />

      <Group justify="flex-end" mt="md">
        <Button type="submit">Submit</Button>
      </Group>
    </form>
  )
}

export function CollectionNavigationBar(){
  return
}