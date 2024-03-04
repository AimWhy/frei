<template>
    <slot v-if="showSlot" :permissions="permissions"></slot>
</template>

<script setup>
import { computed } from 'vue';
import { useAuth } from './useAuth';

const props = defineProps({
    need: {
        type: [String, Array],
    },
    mode: {
        type: String,
        default: 'and',
    },
});

const { permissions } = useAuth();

const showSlot = computed(() => {
    if (props.need) {
        const method = props.mode === 'or' ? 'some' : 'every';
        if (Array.isArray(props.need)) {
            return props.need[method](permission => permissions.value.includes(permission));
        } else {
            return permissions.value.includes(props.need);
        }
    } else {
        return true;
    }
});
</script>
